import DynamoDB from 'aws-sdk/clients/dynamodb'

const checkDynamoTableExists = async ({ region, tableName }) => {
  const database = new DynamoDB({ region })

  console.log(`check dynamo table exists "${tableName}" started`)

  try {
    const tableInfo = await database
      .describeTable({ TableName: tableName })
      .promise()

    const tableStatus = tableInfo.Table.TableStatus

    if (tableStatus === 'ACTIVE') {
      console.log(`check dynamo table exists "${tableName}" done with true`)
      return true
    }

    return await checkDynamoTableExists({ region, tableName })
  } catch (error) {}

  console.log(`check dynamo table exists "${tableName}" done with false`)
  return false
}

export default checkDynamoTableExists
