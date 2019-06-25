import S3 from 'aws-sdk/clients/s3'

import { temporaryErrors } from './constants'

const dropOnS3 = async ({ region, bucketName, fileKey }) => {
  const s3 = new S3({ region })
  console.log(`dropping file on S3 "${bucketName}/${fileKey}" started`)
  while (true) {
    try {
      try {
        await s3
          .deleteObject({
            Bucket: bucketName,
            Key: fileKey
          })
          .promise()

        break
      } catch (error) {
        console.log(
          `dropping file on S3 "${bucketName}/${fileKey}" failed ${error.message}`
        )
        throw error
      }
    } catch (error) {
      if (temporaryErrors.includes(error.code)) {
        continue
      }

      throw error
    }
  }

  console.log(`dropping file on S3 "${bucketName}/${fileKey}" succeeded`)
}

export default dropOnS3
