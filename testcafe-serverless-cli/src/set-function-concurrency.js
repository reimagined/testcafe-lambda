import Lambda from 'aws-sdk/clients/lambda'
import { temporaryErrors } from './constants'

const setFunctionConcurrency = async ({
  region,
  functionName,
  concurrency
}) => {
  const lambda = new Lambda({ region })
  while (true) {
    try {
      await lambda
        .putFunctionConcurrency({
          FunctionName: functionName,
          ReservedConcurrentExecutions: concurrency
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
}

export default setFunctionConcurrency
