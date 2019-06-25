import DynamoDB from 'aws-sdk/clients/dynamodb'

import checkDynamoTableExists from './check-dynamo-table-exists'
import { temporaryErrors } from './constants'

const createDynamoTable = async ({
  tableName,
  billingMode = 'PAY_PER_REQUEST',
  region
}) => {
  const database = new DynamoDB({ region })

  if (await checkDynamoTableExists({ region, tableName })) {
    console.log(`delete dynamo table "${tableName}" started`)
    await database
      .deleteTable({
        TableName: tableName
      })
      .promise()

    while (await checkDynamoTableExists({ region, tableName })) {}
    console.log(`delete dynamo table "${tableName}" succeeded`)
  }

  const schema = {
    AttributeDefinitions: [
      {
        AttributeName: 'launchId',
        AttributeType: 'S'
      },
      {
        AttributeName: 'workerIndex',
        AttributeType: 'N'
      }
    ],
    KeySchema: [
      {
        AttributeName: 'launchId',
        KeyType: 'HASH'
      },
      {
        AttributeName: 'workerIndex',
        KeyType: 'RANGE'
      }
    ]
  }

  console.log(`create dynamo table "${tableName}" started`)
  let dynamoTable = null
  while (true) {
    try {
      dynamoTable = await database
        .createTable({
          TableName: tableName,
          BillingMode: billingMode,
          ...schema
        })
        .promise()
      break
    } catch (error) {
      if (temporaryErrors.includes(error.code)) {
        continue
      }
      throw error
    }
  }
  console.log(`create dynamo table "${tableName}" succeeded`)

  return dynamoTable
}

export default createDynamoTable
