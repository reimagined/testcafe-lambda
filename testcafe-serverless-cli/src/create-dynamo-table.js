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
    await database.deleteTable({
      TableName: tableName
    })

    while (await checkDynamoTableExists({ region, tableName })) {}
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

  while (!(await checkDynamoTableExists({ region, tableName }))) {}

  return dynamoTable
}

export default createDynamoTable
