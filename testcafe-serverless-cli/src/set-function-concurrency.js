import Lambda from 'aws-sdk/clients/lambda'
import { temporaryErrors } from './constants'

const setFunctionConcurrency = async ({
  region,
  functionName,
  concurrency
}) => {
  const lambda = new Lambda({ region })
  console.log(
    `set function "${functionName}" concurrency = ${concurrency} started`
  )
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
      console.log(
        `set function "${functionName}" concurrency = ${concurrency} failed`
      )
      throw error
    }
  }
  console.log(
    `set function "${functionName}" concurrency = ${concurrency} succeeded`
  )
}

export default setFunctionConcurrency
