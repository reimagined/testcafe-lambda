import Lambda from 'aws-sdk/clients/lambda'

import { temporaryErrors } from './constants'

const invokeLambda = async ({
  region,
  lambdaArn,
  payload,
  invocationType = 'RequestResponse'
}) => {
  const lambda = new Lambda({ region })

  console.log(`invoke lambda "${lambdaArn}" started`)
  try {
    while (true) {
      try {
        const lambdaResult = await lambda
          .invoke({
            InvocationType: invocationType,
            FunctionName: lambdaArn,
            Payload: JSON.stringify(payload)
          })
          .promise()

        if (invocationType === 'RequestResponse') {
          if (lambdaResult.FunctionError != null) {
            const error = JSON.parse(lambdaResult.Payload.toString())
            throw error
          }

          console.log(`invoke lambda "${lambdaArn}" succeeded`)
          return JSON.parse(lambdaResult.Payload.toString())
        } else {
          return null
        }
      } catch (error) {
        if (temporaryErrors.includes(error.code)) {
          continue
        }
        throw error
      }
    }
  } catch (e) {
    console.log(`invoke lambda "${lambdaArn}" failed`)
  }
}

export default invokeLambda
