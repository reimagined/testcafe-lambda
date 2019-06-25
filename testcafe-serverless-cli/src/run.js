import path from 'path'
import fs from 'fs'

import uploadToS3 from './upload-to-s3'
import archiveDir from './archive-dir'
import invokeLambda from './invoke-lambda'
import readDynamoTable from './read-dynamo-table'

import {
  bucketName,
  testcafeWorkerName,
  testcafeBuilderName,
  testcafeTableName
} from './constants'

const run = async ({
  region,
  accountId,
  testcafeDir,
  concurrency,
  testPattern,
  skipJsErrors,
  skipUncaughtErrors,
  selectorTimeout,
  assertionTimeout,
  pageLoadTimeout,
  speed,
  stopOnFirstFail
}) => {
  const testcafeArchive = path.join(process.cwd(), `archive-${Date.now()}.zip`)

  await archiveDir({
    inputDirectory: testcafeDir,
    outputArchive: testcafeArchive
  })

  const testcafeArchiveKey = `testcafe-app-${Date.now()}-${Math.floor(
    Math.random() * 1000000000000
  )}`

  await uploadToS3({
    file: testcafeArchive,
    region,
    bucketName,
    fileKey: testcafeArchiveKey
  })

  fs.unlinkSync(testcafeArchive)

  console.log(`Uploaded to key "${testcafeArchiveKey}"`)

  console.log('Installing started')

  let builtResult = null
  try {
    builtResult = await invokeLambda({
      region,
      lambdaArn: `arn:aws:lambda:${region}:${accountId}:function:${testcafeBuilderName}`,
      payload: {
        fileKey: testcafeArchiveKey,
        region
      }
    })
  } catch (error) {
    throw new Error(
      `Build testcafe app failed: ${JSON.stringify(builtResult, null, 2)}`
    )
  }

  const { outputFileKey: builtFileKey, installLog } = builtResult

  console.log(installLog)

  console.log('Installing succeeded')

  console.log(`Installed app saved at key "${builtFileKey}"`)

  console.log('Testcafe started')

  const workerLambdaArn = `arn:aws:lambda:${region}:${accountId}:function:${testcafeWorkerName}`

  const launchId = `testcafe-execution-${Date.now()}-${Math.floor(
    Math.random() * 1000000000000
  )}`

  const invocationPromises = []
  for (let workerIndex = 0; workerIndex < concurrency; workerIndex++) {
    invocationPromises.push(
      invokeLambda({
        region,
        lambdaArn: workerLambdaArn,
        payload: {
          fileKey: builtFileKey,
          launchId,
          workerIndex,
          region,
          testPattern,
          skipJsErrors,
          skipUncaughtErrors,
          selectorTimeout,
          assertionTimeout,
          pageLoadTimeout,
          speed,
          stopOnFirstFail
        },
        invocationType: 'Event'
      })
    )
  }

  await Promise.all(invocationPromises)

  setInterval(async () => {
    const items = await readDynamoTable({
      region,
      launchId,
      tableName: testcafeTableName
    })

    console.log(JSON.stringify(items, null, 2))
  }, 15000)
}

export default run
