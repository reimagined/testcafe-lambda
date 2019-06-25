import DynamoDB from 'aws-sdk/clients/dynamodb'

import { temporaryErrors } from './constants'

const executeSingleQuery = async (documentClient, query) => {
  while (true) {
    try {
      return await documentClient.query(query).promise()
    } catch (error) {
      if (!temporaryErrors.includes(error.code)) {
        throw error
      }
    }
  }
}

const readDynamoTable = async ({ launchId, tableName, region }) => {
  const documentClient = new DynamoDB.DocumentClient({ region })

  console.log(`read dynamo table "${tableName}" started`)

  try {
    const query = {
      TableName: tableName,
      KeyConditionExpression: '#launchId = :launchId',
      ExpressionAttributeNames: {
        '#launchId': 'launchId'
      },
      ExpressionAttributeValues: {
        ':launchId': launchId
      },
      ScanIndexForward: true
    }

    const result = []
    let singleResult

    do {
      singleResult = await executeSingleQuery(documentClient, query)

      query.ExclusiveStartKey = singleResult.LastEvaluatedKey

      for (const item of singleResult.Items) {
        result.push(item)
      }
    } while (singleResult.LastEvaluatedKey != null)
    console.log(`read dynamo table "${tableName}" succeeded`)
    return result
  } catch (error) {
    console.log(`read dynamo table "${tableName}" failed`)
  }
}

export default readDynamoTable
