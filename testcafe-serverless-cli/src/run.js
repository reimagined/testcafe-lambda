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
import setFunctionConcurrency from './set-function-concurrency'

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

  process.on(
    'SIGINT',
    setFunctionConcurrency.bind(null, {
      region,
      functionName: testcafeWorkerName,
      concurrency: 0
    })
  )

  await setFunctionConcurrency({
    region,
    functionName: testcafeWorkerName,
    concurrency
  })

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

  while (true) {
    const items = await readDynamoTable({
      region,
      launchId,
      tableName: testcafeTableName
    })

    const doneWorkers = new Set(
      items
        .filter(({ report, error }) => report != null || error != null)
        .map(({ workerIndex }) => workerIndex)
    ).size

    if (doneWorkers !== concurrency) {
      console.log(
        `Ready ${doneWorkers} workers from ${concurrency}, waiting...`
      )

      await new Promise(resolve => setTimeout(resolve, 15000))

      continue
    }

    for (const { workerIndex, report, error } of items) {
      if (report != null) {
        console.log(`=== WORKER ${workerIndex} REPORT ===`)
        console.log(JSON.stringify(report, null, 2))
      } else if (error != null) {
        console.log(`=== WORKER ${workerIndex} ERROR ===`)
        console.log(JSON.stringify(error, null, 2))
      }
    }

    break
  }

  await setFunctionConcurrency({
    region,
    functionName: testcafeWorkerName,
    concurrency: 0
  })
}

export default run
