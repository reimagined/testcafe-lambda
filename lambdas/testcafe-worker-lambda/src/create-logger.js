import writeDynamoTable from './write-dynamo-table'

const createLogger = ({ tableName, region, launchId, workerIndex }) => {
  let queue

  const logs = []

  const log = (...args) => {
    logs.push(...args)

    queue = queue.then(() =>
      writeDynamoTable({
        tableName,
        region,
        launchId,
        workerIndex,
        data: {
          stdout: logs.join('\r\n')
        }
      })
    )
  }

  const flush = async () => {
    await queue
  }

  return {
    log,
    flush
  }
}

export default createLogger
