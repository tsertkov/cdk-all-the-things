import { LambdaClient } from '@aws-sdk/client-lambda'
import { ECRClient } from '@aws-sdk/client-ecr'
import { ecrCodeSha256DigestByTag } from './lib/ecr.js'
import {
  cleanupFunctionVersions,
  createFunctionVersionWithTag,
  functionVersionArnByCodeSha256,
  waitFunctionReady,
} from './lib/lambda.js'

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
  // eslint-disable-next-line @typescript-eslint/no-extra-semi
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
