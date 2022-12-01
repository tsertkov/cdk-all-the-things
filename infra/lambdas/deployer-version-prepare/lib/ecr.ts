import { BatchGetImageCommand, ECRClient } from '@aws-sdk/client-ecr'

export async function ecrCodeSha256DigestByTag(
  ecrClient: ECRClient,
  repositoryName: string,
  tag: string
) {
  const batchGetImageCommand = new BatchGetImageCommand({
    imageIds: [{ imageTag: tag }],
    repositoryName,
  })

  const ecrRes = await ecrClient.send(batchGetImageCommand)
  if (!ecrRes.images?.length) {
    return null
  }

  const [image] = ecrRes.images
  if (
    !image?.imageId?.imageDigest ||
    !image?.imageId.imageDigest.startsWith('sha256:')
  ) {
    throw new Error('No imageDigest found in the response')
  }

  const codeSha256 = image.imageId.imageDigest.substring(7)
  return codeSha256
}
