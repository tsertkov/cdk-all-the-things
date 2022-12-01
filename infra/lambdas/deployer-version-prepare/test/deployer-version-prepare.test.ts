import { jest } from '@jest/globals'
import { mockClient } from 'aws-sdk-client-mock'
import {
  DeleteFunctionCommand,
  FunctionConfiguration,
  GetFunctionCommand,
  LambdaClient,
  ListVersionsByFunctionCommand,
  UpdateFunctionCodeCommand,
} from '@aws-sdk/client-lambda'
import { BatchGetImageCommand, ECRClient } from '@aws-sdk/client-ecr'
import {
  lambdaProbeDelayMs,
  lambdaVersionsToKeep,
} from './deployer-version-prepare.test-setup.js'
// eslint-disable-next-line
import { handler } from '../deployer-version-prepare.js'

describe('deployer-version-prepare lambda', () => {
  // input constants
  const deployerRepoDomain = 'test-deployer-repo-domain.example.com'
  const deployerRepoName = 'test-deployer-repo-name'
  const deployerFunctionName = 'test-deployer-function-name'
  const version = 'v1.2.3'

  // shortcut handler
  const invokeHandlerWithDefaulParams = () =>
    handler({
      deployerRepoDomain,
      deployerRepoName,
      deployerFunctionName,
      version,
    })

  // runtime values
  const imageDigest = 'test-digest'
  const imageTag = 'test-tag'
  const functionVersionArn = 'test-function-version-arn'

  // aws sdk client mmocks
  const lambdaClientMock = mockClient(LambdaClient)
  const ecrClientMock = mockClient(ECRClient)

  beforeEach(() => {
    lambdaClientMock.reset()
    ecrClientMock.reset()
    jest.spyOn(console, 'log').mockImplementation(jest.fn)
  })

  describe('Given lambda version already exists', () => {
    beforeEach(() => {
      // mock lambda list-versions-by-function
      lambdaClientMock.on(ListVersionsByFunctionCommand).resolves({
        Versions: [
          {
            FunctionArn: functionVersionArn,
            CodeSha256: imageDigest,
            Version: '1',
          },
        ],
      })

      // mock ecr batch-get-image
      ecrClientMock.on(BatchGetImageCommand).resolves({
        images: [
          {
            imageId: {
              imageDigest: `sha256:${imageDigest}`,
              imageTag,
            },
          },
        ],
      })
    })

    it('should return existing lambda version', async () => {
      const res = await invokeHandlerWithDefaulParams()
      expect(res).toBe(functionVersionArn)
    })
  })

  describe('Given not all required params were provided in the input', () => {
    it('should throw', async () => {
      await expect(
        // eslint-disable-next-line
        // @ts-ignore: invalid function input
        handler({})
      ).rejects.toThrow()
    })
  })

  describe('Given ecr image was updated, but image tag did not update', () => {
    const versions = [
      {
        FunctionArn: 'arn-1',
        CodeSha256: 'sha256:new-sha1',
        Version: '1',
      },
    ] as FunctionConfiguration[]

    beforeEach(() => {
      // mock lambda list-versions-by-function
      lambdaClientMock
        .on(ListVersionsByFunctionCommand)
        .resolves({ Versions: versions })

      // mock lambda UpdateFunctionCodeCommand
      lambdaClientMock
        .on(UpdateFunctionCodeCommand)
        .resolves({ FunctionArn: functionVersionArn })

      // mock lambda GetFunctionCommand
      lambdaClientMock.on(GetFunctionCommand).resolves({
        Configuration: {
          State: 'Active',
        },
      })

      // mock ecr batch-get-image
      ecrClientMock.on(BatchGetImageCommand).resolves({
        images: [
          {
            imageId: {
              imageDigest: `sha256:${imageDigest}`,
              imageTag,
            },
          },
        ],
      })
    })

    it('should return new lambda version', async () => {
      const res = await invokeHandlerWithDefaulParams()
      expect(res).toBe(functionVersionArn)
      expect(
        lambdaClientMock.commandCalls(UpdateFunctionCodeCommand, {
          FunctionName: deployerFunctionName,
          Publish: true,
        })
      )
    })
  })

  describe('Given lambda version does not exists', () => {
    beforeEach(() => {
      // mock lambda list-versions-by-function
      lambdaClientMock
        .on(ListVersionsByFunctionCommand)
        .resolves({ Versions: [] })

      // mock lambda UpdateFunctionCodeCommand
      lambdaClientMock
        .on(UpdateFunctionCodeCommand)
        .resolves({ FunctionArn: functionVersionArn })

      // mock lambda GetFunctionCommand
      lambdaClientMock.on(GetFunctionCommand).resolves({
        Configuration: {
          State: 'Active',
        },
      })

      // mock lambda DeleteFunctionCommand
      lambdaClientMock.on(DeleteFunctionCommand).resolves({})

      // mock ecr batch-get-image
      ecrClientMock.on(BatchGetImageCommand).resolves({
        images: [
          {
            imageId: {
              imageDigest: `sha256:${imageDigest}`,
              imageTag,
            },
          },
        ],
      })
    })

    it('should return new lambda version', async () => {
      const res = await invokeHandlerWithDefaulParams()

      // expect calling UpdateFunctionCode
      expect(
        lambdaClientMock.commandCalls(UpdateFunctionCodeCommand)[0]?.args[0]
          .input
      ).toEqual({
        FunctionName: deployerFunctionName,
        ImageUri: `${deployerRepoDomain}/${deployerRepoName}:${version}`,
        Publish: true,
      })

      expect(res).toBe(functionVersionArn)
    })

    it('should wait new function version to become active', async () => {
      // mock lambda GetFunctionCommand
      lambdaClientMock.on(GetFunctionCommand).resolves({
        Configuration: {
          State: 'Pending',
        },
      })

      setTimeout(() => {
        lambdaClientMock.on(GetFunctionCommand).resolves({
          Configuration: {
            State: 'Active',
          },
        })
      }, lambdaProbeDelayMs * 2)

      const res = await invokeHandlerWithDefaulParams()
      expect(res).toBe(functionVersionArn)
    })

    it('should remove outdated lambda versions', async () => {
      const allVersions = [
        {
          FunctionName: 'fn-1',
          FunctionArn: 'arn-1',
          Version: '1',
          LastModified: '1997-07-16T19:20:30.45+01:00',
        },
        {
          FunctionName: 'fn-2',
          FunctionArn: 'arn-2',
          Version: '2',
          LastModified: '1997-07-16T19:20:30.46+01:00',
        },
      ] as FunctionConfiguration[]

      const versionsToRemove = allVersions
        .slice(0, allVersions.length - lambdaVersionsToKeep)
        .reverse()

      lambdaClientMock
        .on(ListVersionsByFunctionCommand)
        .resolves({ Versions: allVersions })

      await invokeHandlerWithDefaulParams()

      // expect two calls to DeleteFunctionCommand
      expect(lambdaClientMock.commandCalls(DeleteFunctionCommand).length).toBe(
        versionsToRemove.length
      )

      versionsToRemove.forEach((version, i) => {
        expect(
          lambdaClientMock.commandCalls(DeleteFunctionCommand)[i]?.args[0].input
        ).toEqual({
          FunctionName: version.FunctionName,
          Qualifier: version.Version,
        })
      })
    })

    it('should not remove $LATEST lambda version', async () => {
      const allVersions = [
        {
          FunctionName: 'fn-1',
          FunctionArn: 'arn-1',
          Version: '$LATEST',
          LastModified: '1997-07-16T19:20:30.45+01:00',
        },
        {
          FunctionName: 'fn-2',
          FunctionArn: 'arn-2',
          Version: '$LATEST',
          LastModified: '1997-07-16T19:20:30.46+01:00',
        },
      ] as FunctionConfiguration[]

      lambdaClientMock
        .on(ListVersionsByFunctionCommand)
        .resolves({ Versions: allVersions })

      expect(lambdaClientMock.commandCalls(DeleteFunctionCommand).length).toBe(
        0
      )
    })

    it('should not remove just created lambda version', async () => {
      const allVersions = [
        {
          FunctionName: 'fn-1',
          FunctionArn: functionVersionArn,
          Version: '1',
          LastModified: '1997-07-16T19:20:30.45+01:00',
        },
        {
          FunctionName: 'fn-2',
          FunctionArn: functionVersionArn,
          Version: '2',
          LastModified: '1997-07-16T19:20:30.46+01:00',
        },
      ] as FunctionConfiguration[]

      lambdaClientMock
        .on(ListVersionsByFunctionCommand)
        .resolves({ Versions: allVersions })

      expect(lambdaClientMock.commandCalls(DeleteFunctionCommand).length).toBe(
        0
      )
    })

    describe('When ecr image does not exists', () => {
      it('should throw', async () => {
        ecrClientMock.on(BatchGetImageCommand).resolves({ images: [] })
        await expect(invokeHandlerWithDefaulParams()).rejects.toThrow()
      })
    })

    describe('When new lambda version fails to become active', () => {
      it('should throw', async () => {
        lambdaClientMock.on(GetFunctionCommand).resolves({
          Configuration: {
            State: 'Failed',
            StateReason: 'Failed for a test reason',
          },
        })

        await expect(invokeHandlerWithDefaulParams()).rejects.toThrow()
      })
    })
  })
})
