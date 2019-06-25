import Lambda from 'aws-sdk/clients/lambda'

import { temporaryErrors } from './constants'

const invokeLambda = async ({
  region,
  lambdaArn,
  payload,
  invocationType = 'RequestResponse'
}) => {
  const lambda = new Lambda({ region })

  while (true) {
    try {
      const { Payload, FunctionError } = await lambda
        .invoke({
          InvocationType: invocationType,
          FunctionName: lambdaArn,
          Payload: JSON.stringify(payload)
        })
        .promise()

      if (FunctionError != null) {
        const error = JSON.parse(Payload.toString())
        throw error
      }

      return JSON.parse(Payload.toString())
    } catch (error) {
      if (temporaryErrors.includes(error.code)) {
        continue
      }

      throw error
    }
  }
}

export default invokeLambda
