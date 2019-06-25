import DynamoDB from 'aws-sdk/clients/dynamodb'

const checkDynamoTableExists = async ({ region, tableName }) => {
  const database = new DynamoDB({ region })

  try {
    const tableInfo = await database
      .describeTable({ TableName: tableName })
      .promise()

    const tableStatus = tableInfo.Table.TableStatus

    if (tableStatus === 'ACTIVE') {
      return true
    }

    return await checkDynamoTableExists({ region, tableName })
  } catch (error) {}

  return false
}

export default checkDynamoTableExists
