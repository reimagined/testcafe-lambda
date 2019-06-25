import path from 'path'

import createS3Bucket from './create-s3-bucket'
import uploadToS3 from './upload-to-s3'
import createLambda from './create-lambda'
import dropOnS3 from './drop-on-s3'

import {
  bucketName,
  testcafeWorkerName,
  testcafeBuilderName,
  testcafeTableName
} from './constants'
import checkDynamoTableExists from './check-dynamo-table-exists'
import createDynamoTable from './create-dynamo-table'

const testcafeWorkerFile = path.join(
  __dirname,
  '..',
  'lambdas',
  'testcafe-worker-lambda.zip'
)
const testcafeBuilderFile = path.join(
  __dirname,
  '..',
  'lambdas',
  'testcafe-builder-lambda.zip'
)

const getPolicyContent = ({ region, accountId, lambdaName, tableName }) => [
  {
    Effect: 'Allow',
    Action: ['s3:*'],
    Resource: `arn:aws:s3:::${bucketName}/*`
  },
  {
    Action: ['dynamodb:Query', 'dynamodb:UpdateItem'],
    Resource: `arn:aws:dynamodb:${region}:${accountId}:table/${tableName}`,
    Effect: 'Allow'
  },
  {
    Effect: 'Allow',
    Action: ['logs:PutLogEvents', 'logs:CreateLogStream'],
    Resource: [
      `arn:aws:logs:${region}:${accountId}:log-group:/aws/lambda/${lambdaName}`,
      `arn:aws:logs:${region}:${accountId}:log-group:/aws/lambda/${lambdaName}:*`
    ]
  },
  {
    Effect: 'Allow',
    Action: 'logs:CreateLogGroup',
    Resource: `arn:aws:logs:${region}:${accountId}:log-group:/aws/lambda/*`
  }
]

const init = async ({ region, accountId }) => {
  await createS3Bucket({ region, bucketName })

  await createDynamoTable({ region, tableName: testcafeTableName })

  await Promise.all([
    uploadToS3({
      file: testcafeWorkerFile,
      region,
      bucketName,
      fileKey: testcafeWorkerName
    }),
    uploadToS3({
      file: testcafeBuilderFile,
      region,
      bucketName,
      fileKey: testcafeBuilderName
    })
  ])

  await Promise.all([
    createLambda({
      functionName: testcafeWorkerName,
      bucketName,
      fileKey: testcafeWorkerName,
      region,
      policyContent: getPolicyContent({
        region,
        accountId,
        lambdaName: testcafeWorkerName,
        tableName: testcafeTableName
      }),
      memorySize: 1600
    }),
    createLambda({
      functionName: testcafeBuilderName,
      bucketName,
      fileKey: testcafeBuilderName,
      region,
      policyContent: getPolicyContent({
        region,
        accountId,
        lambdaName: testcafeBuilderName,
        tableName: testcafeTableName
      }),
      memorySize: 1600
    })
  ])

  await Promise.all([
    dropOnS3({
      region,
      bucketName,
      fileKey: testcafeWorkerName
    }),
    dropOnS3({
      region,
      bucketName,
      fileKey: testcafeBuilderName
    })
  ])

  while (
    !(await checkDynamoTableExists({ region, tableName: testcafeTableName }))
  ) {}
}

export default init
