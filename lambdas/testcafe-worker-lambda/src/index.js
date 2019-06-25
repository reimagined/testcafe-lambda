import chromium from 'chrome-aws-lambda'
import createTestCafe from 'testcafe'
import stream from 'stream'
import path from 'path'
import { sync as rimraf } from 'rimraf'
import fs from 'fs'

import downloadFromS3 from './download-from-s3'
import unarchiveDir from './unarchive-dir'

import { bucketName, testcafeTableName, heartBeatInterval } from './constants'
import writeDynamoTable from './write-dynamo-table'

let heartBeat

const handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false

  clearInterval(heartBeat)

  const {
    fileKey,
    region,
    testPattern,
    skipJsErrors,
    skipUncaughtErrors,
    selectorTimeout,
    assertionTimeout,
    pageLoadTimeout,
    speed,
    stopOnFirstFail,
    launchId,
    workerIndex
  } = event

  heartBeat = setInterval(
    async () =>
      await writeDynamoTable({
        tableName: testcafeTableName,
        region,
        launchId,
        workerIndex,
        data: {
          lastActiveTimestamp: Date.now()
        }
      }),
    heartBeatInterval
  )

  console.log('Worker launched', JSON.stringify(event))

  let testcafe = null,
    browser = null
  try {
    rimraf(path.join('/tmp/*'))
    const testcafeAppArchivePath = await downloadFromS3({
      region,
      bucketName,
      fileKey
    })

    const testcafeAppDir = path.join('/tmp', `testcafe-app-${Date.now()}`)
    fs.mkdirSync(testcafeAppDir)

    await unarchiveDir({
      fileName: testcafeAppArchivePath,
      outputDir: testcafeAppDir
    })

    testcafe = await createTestCafe('localhost', 1337, 1338)
    const remoteConnection = await testcafe.createBrowserConnection()
    console.log('Testcafe server launched at', remoteConnection.url)

    const connectionDonePromise = new Promise(resolve =>
      remoteConnection.once('ready', resolve)
    )

    browser = await chromium.puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless
    })

    console.log('Headless browser launched as', await browser.userAgent())

    await (await browser.newPage()).goto(remoteConnection.url)
    await connectionDonePromise
    console.log('Testcafe server accepted connection from headless browser')

    let resultBuffer = Buffer.from('')

    const failedCount = await testcafe
      .createRunner()
      .reporter([
        'spec',
        {
          name: 'json',
          output: new stream.Writable({
            write(chunk, _, next) {
              resultBuffer = Buffer.concat([resultBuffer, chunk])
              next()
            }
          })
        }
      ])
      .src(`${testcafeAppDir}/${testPattern}`)
      .browsers(remoteConnection)
      .run({
        skipJsErrors,
        skipUncaughtErrors,
        selectorTimeout,
        assertionTimeout,
        pageLoadTimeout,
        speed,
        stopOnFirstFail
      })

    const result = JSON.parse(resultBuffer.toString('utf8'))

    await writeDynamoTable({
      tableName: testcafeTableName,
      region,
      launchId,
      workerIndex,
      data: {
        report: result
      }
    })

    if (failedCount > 0) {
      console.error(`Failed ${failedCount} functional tests`)
    }

    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    console.error('Unhandled exception ', error)

    await writeDynamoTable({
      tableName: testcafeTableName,
      region,
      launchId,
      workerIndex,
      data: {
        error: {
          message: error.message,
          code: error.code,
          stack: error.stack
        }
      }
    })
  }

  clearInterval(heartBeat)

  if (testcafe != null) {
    await testcafe.close()
  }

  if (browser != null) {
    await browser.close()
  }

  rimraf(path.join('/tmp/*'))
}

export { handler }
