import S3 from 'aws-sdk/clients/s3'

import { temporaryErrors } from './constants'

const createS3Bucket = async ({ region, bucketName }) => {
  const s3 = new S3({ region })

  while (true) {
    try {
      return await s3
        .createBucket({
          Bucket: bucketName,
          ACL: 'public-read'
        })
        .promise()
    } catch (error) {
      if (temporaryErrors.includes(error.code)) {
        continue
      }

      throw error
    }
  }
}

export default createS3Bucket
