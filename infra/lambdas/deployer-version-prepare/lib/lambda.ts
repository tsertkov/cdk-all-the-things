import {
  DeleteFunctionCommand,
  GetFunctionCommand,
  LambdaClient,
  ListVersionsByFunctionCommand,
  UpdateFunctionCodeCommand,
} from '@aws-sdk/client-lambda'

export async function createFunctionVersionWithTag(
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

export async function waitFunctionReady(
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

export async function functionVersionArnByCodeSha256(
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

export async function cleanupFunctionVersions(
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
