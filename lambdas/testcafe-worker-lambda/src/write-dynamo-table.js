import DynamoDB from 'aws-sdk/clients/dynamodb'

import { temporaryErrors } from './constants'

const writeDynamoTable = async ({
  tableName,
  region,
  launchId,
  workerIndex,
  data
}) => {
  const documentClient = new DynamoDB.DocumentClient({ region })

  while (true) {
    try {
      await documentClient
        .update({
          TableName: tableName,
          Item: {
            launchId,
            workerIndex,
            ...data
          }
        })
        .promise()
      break
    } catch (error) {
      if (!temporaryErrors.includes(error.code)) {
        throw error
      }
    }
  }
}

export default writeDynamoTable
