import {
  DeleteFunctionCommand,
  GetFunctionCommand,
  LambdaClient,
  ListVersionsByFunctionCommand,
  UpdateFunctionCodeCommand,
} from '@aws-sdk/client-lambda'

import { BatchGetImageCommand, ECRClient } from '@aws-sdk/client-ecr'

const LAMBDA_PROBE_DELAY_MS =
  Number(process.env['LAMBDA_PROBE_DELAY_MS']) || 5000
const LAMBDA_VERSIONS_TO_KEEP =
  Number(process.env['LAMBDA_VERSIONS_TO_KEEP']) || 10

interface DeployerVersionPrepareInput {
  version: string
  deployerFunctionName: string
  deployerRepoName: string
  deployerRepoDomain: string
}

export async function handler(event: DeployerVersionPrepareInput) {
  validateDeployerVersionPrepareInput(event)
  return deployerVersionPrepare(event)
}

function validateDeployerVersionPrepareInput(
  event: DeployerVersionPrepareInput
) {
  // eslint-disable-next-line
  ;[
    'version',
    'deployerFunctionName',
    'deployerRepoName',
    'deployerRepoDomain',
  ].forEach((key) => {
    if (!(key in event)) {
      throw new Error(`Required input parameter was not provided: '${key}'`)
    }
  })
}

async function deployerVersionPrepare({
  version,
  deployerFunctionName,
  deployerRepoName,
  deployerRepoDomain,
}: DeployerVersionPrepareInput): Promise<string> {
  const ecrClient = new ECRClient({})

  // find ecr image codesha by container image tag
  const codeSha256 = await ecrCodeSha256DigestByTag(
    ecrClient,
    deployerRepoName,
    version
  )

  if (codeSha256 === null) {
    throw new Error(
      `Required ecr image was not found: '${deployerRepoName}:${version}'`
    )
  }

  // find and return lambda version arn for codeSha256 if it already exists
  const lambdaClient = new LambdaClient({})
  const existingFunctionVersionArn = await functionVersionArnByCodeSha256(
    lambdaClient,
    deployerFunctionName,
    codeSha256
  )

  if (existingFunctionVersionArn !== null) {
    return existingFunctionVersionArn
  }

  // create new lambda version
  const newFunctionVersionArn = await createFunctionVersionWithTag(
    lambdaClient,
    deployerFunctionName,
    deployerRepoDomain + '/' + deployerRepoName,
    version
  )

  // wait function version to get ready
  // remove outdated lambda versions
  await Promise.all([
    waitFunctionReady(
      lambdaClient,
      newFunctionVersionArn,
      LAMBDA_PROBE_DELAY_MS
    ),
    cleanupFunctionVersions(
      lambdaClient,
      deployerFunctionName,
      newFunctionVersionArn,
      LAMBDA_VERSIONS_TO_KEEP
    ),
  ])

  return newFunctionVersionArn
}

async function createFunctionVersionWithTag(
  lambdaClient: LambdaClient,
  functionName: string,
  noTagImageUri: string,
  tag: string
) {
  const updateFunctionCodeCommand = new UpdateFunctionCodeCommand({
    FunctionName: functionName,
    ImageUri: noTagImageUri + ':' + tag,
    Publish: true,
  })

  const updateFunctionCodeResponse = await lambdaClient.send(
    updateFunctionCodeCommand
  )

  if (!updateFunctionCodeResponse.FunctionArn) {
    throw new Error('Required .FunctionArn field was not found in the reponse')
  }

  return updateFunctionCodeResponse.FunctionArn
}

async function waitFunctionReady(
  lambdaClient: LambdaClient,
  functionArn: string,
  probeDelay: number
) {
  const getFunctionCommand = new GetFunctionCommand({
    FunctionName: functionArn,
  })

  let getFunctionResponse
  for (;;) {
    // wait probeDelay before sending request
    await new Promise((resolve) => setTimeout(resolve, probeDelay))
    getFunctionResponse = await lambdaClient.send(getFunctionCommand)
    if (getFunctionResponse?.Configuration?.State !== 'Pending') break
    console.log('Function is still in Pending state. Sleeping.')
  }

  if (getFunctionResponse?.Configuration?.State !== 'Active') {
    const state = getFunctionResponse?.Configuration?.State
    const stateReason = getFunctionResponse?.Configuration?.StateReason

    throw new Error(
      `Failed waiting function version to activate. State: '${state}', StateReason: '${stateReason}'`
    )
  }
}

async function cleanupFunctionVersions(
  lambdaClient: LambdaClient,
  functionName: string,
  functionVersionArnToSkip: string,
  lambdaVersionsToKeep: number
) {
  const listVersionsByFunctionCommand = new ListVersionsByFunctionCommand({
    FunctionName: functionName,
    MaxItems: 50,
  })

  const listVersionsByFunctionResponse = await lambdaClient.send(
    listVersionsByFunctionCommand
  )

  if (!listVersionsByFunctionResponse.Versions?.length) {
    return
  }

  // sort versions by last modified (creation) date. new to old
  const sortedVersions = listVersionsByFunctionResponse.Versions.sort(
    (a, b) =>
      new Date(b.LastModified as string).getTime() -
      new Date(a.LastModified as string).getTime()
  )

  // extract version to delete
  const versionsToDelete = sortedVersions
    .filter(
      ({ FunctionArn, Version }) =>
        Version === '$LATEST' || FunctionArn !== functionVersionArnToSkip
    )
    .splice(lambdaVersionsToKeep)

  // delete outdated versions
  await Promise.all(
    versionsToDelete.map(({ FunctionName, Version }) =>
      lambdaClient
        .send(
          new DeleteFunctionCommand({
            FunctionName,
            Qualifier: Version,
          })
        )
        .then((res) => {
          console.log(
            `Function version removed: FunctionName: '${FunctionName}', Version: '${Version}'`
          )
          return res
        })
    )
  )
}

async function functionVersionArnByCodeSha256(
  lambdaClient: LambdaClient,
  functionName: string,
  codeSha256: string
) {
  const listVersionsByFunctionCommand = new ListVersionsByFunctionCommand({
    FunctionName: functionName,
    MaxItems: 50,
  })

  const lambdaRes = await lambdaClient.send(listVersionsByFunctionCommand)
  if (!lambdaRes.Versions?.length) {
    return null
  }

  for (const lambdaVersion of lambdaRes.Versions) {
    // exclude special $LATEST version as only prepared lambda versions are to be used
    if (lambdaVersion.Version === '$LATEST') continue
    if (lambdaVersion.CodeSha256 === codeSha256) {
      return lambdaVersion.FunctionArn as string
    }
  }

  return null
}

async function ecrCodeSha256DigestByTag(
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
