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

  const query = {
    TableName: tableName,
    Key: { launchId, workerIndex },
    ExpressionAttributeNames: {},
    ExpressionAttributeValues: {}
  }

  for (const [index, key] of Object.entries(Object.keys(data))) {
    const currentUpdateExpression = `#field${index} = :value${index}`

    if (query.UpdateExpression == null) {
      query.UpdateExpression = `set ${currentUpdateExpression}`
    } else {
      query.UpdateExpression += `, ${currentUpdateExpression}`
    }

    query.ExpressionAttributeNames[`#field${index}`] = key

    query.ExpressionAttributeValues[`:value${index}`] = data[key]
  }

  while (true) {
    try {
      await documentClient.update(query).promise()
      break
    } catch (error) {
      if (!temporaryErrors.includes(error.code)) {
        throw error
      }
    }
  }
}

export default writeDynamoTable
