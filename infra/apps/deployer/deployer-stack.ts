import { Construct } from 'constructs'
import { Aws } from 'aws-cdk-lib'
import { NestedStackBase, NestedStackBaseProps } from '../../lib/nested-stack-base'
import { StateStack } from './state-stack'
import { DeployerStageProps } from './deployer-config'
import { Artifact, Pipeline } from 'aws-cdk-lib/aws-codepipeline'
import { BuildSpec, LinuxBuildImage, PipelineProject } from 'aws-cdk-lib/aws-codebuild'
import { PolicyStatement } from 'aws-cdk-lib/aws-iam'
import { CodeBuildAction, ManualApprovalAction, S3SourceAction, S3Trigger } from 'aws-cdk-lib/aws-codepipeline-actions'
import { regionToCode } from '../../lib/utils'

export interface DeployerStackProps extends NestedStackBaseProps {
  readonly stateStack: StateStack
}

export class DeployerStack extends NestedStackBase {
  protected readonly config: DeployerStageProps
  readonly stateStack: StateStack
  readonly githubOidcProviderArn: string
  readonly codePipelines: Pipeline[] = []
  codeBuild: PipelineProject
  sdPipeline: Pipeline

  constructor(scope: Construct, id: string, props: DeployerStackProps) {
    super(scope, id, props)
    this.stateStack = props.stateStack

    this.initCodeBuild()
    this.initPipelines()
  }

  private initPipelines () {
    // codepipeline pipelines for each app & regions within current stage
    this.config.appModules.forEach(appName => {
      this.codePipelines.push(
        this.initCodePipeline(
          this.config.rootConfig.stageConfig(this.config.stageName, appName) as DeployerStageProps
        )
      )
    })
  }

  private initCodePipeline (props: DeployerStageProps): Pipeline {
    // init deployment code pipeline for given app & regions
    const {
      project,
      appName,
      stageName,
      regions,
    } = props

    const pipelineName = `${project}-${appName}-${stageName}`
    const configArtifact = new Artifact(pipelineName)
    const bucketKey = `${stageName}.zip`

    const sourceAction = new S3SourceAction({
      bucketKey,
      actionName: bucketKey,
      bucket: this.stateStack.artifactsBucket,
      output: configArtifact,
      trigger: S3Trigger.NONE,
    })

    const diffActions = regions.map(region => {
      const regname = regionToCode(region)
      return new CodeBuildAction({
        runOrder: 1,
        actionName: `diff-${regname}`,
        project: this.codeBuild,
        input: configArtifact,
        environmentVariables: {
          CMD: {
            value: 'diff',
          },
        },
      })
    })

    const deployActions = regions.map(region => {
      const regname = regionToCode(region)
      return new CodeBuildAction({
        runOrder: 3,
        actionName: `deploy-${regname}`,
        project: this.codeBuild,
        input: configArtifact,
        environmentVariables: {
          CMD: {
            value: 'deploy',
          },
        },
      })
    })

    const approveAction = new ManualApprovalAction({
      runOrder: 2,
      actionName: `approve-deploy`,
    })

    return new Pipeline(this, `${appName}-${stageName}-pipeline`, {
      pipelineName,
      artifactBucket: this.stateStack.artifactsBucket,
      restartExecutionOnUpdate: appName === this.config.appName,
      stages: [{
        stageName: 'read-config',
        actions: [ sourceAction ],
      }, {
        stageName: `deploy-${stageName}-${appName}`,
        actions: [
          ...diffActions,
          ...deployActions,
          approveAction,
        ],
      }],
    })
  }

  private initCodeBuild () {
    const projectName = `${this.config.project}-${this.config.appName}-${this.config.stageName}`
    this.codeBuild = new PipelineProject(this, 'CodeBuild', {
      projectName,
      logging: {
        cloudWatch: {
          logGroup: this.stateStack.deployerLogGroup,
        },
      },
      environment: {
        buildImage: LinuxBuildImage.AMAZON_LINUX_2_3,
        privileged: true,
        environmentVariables: {
          DEPLOYER_IMAGE: {
            value: this.stateStack.deployerEcrRepo.repositoryUri,
          },
        },
      },
      buildSpec: BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            commands: [
              'CREDS=$(curl -s 169.254.170.2$AWS_CONTAINER_CREDENTIALS_RELATIVE_URI)',
              'export AWS_SESSION_TOKEN=$(echo "${CREDS}" | jq -r \'.Token\')',
              'export AWS_ACCESS_KEY_ID=$(echo "${CREDS}" | jq -r \'.AccessKeyId\')',
              'export AWS_SECRET_ACCESS_KEY=$(echo "${CREDS}" | jq -r \'.SecretAccessKey\')',
              '$(aws ecr get-login --no-include-email)',
              'export IMAGE=${DEPLOYER_IMAGE}:$(cat ' + this.config.stageName + ')',
              'docker pull $IMAGE',
            ]
          },
          build: {
            commands: [
              [
                'docker run',
                '-e AWS_SESSION_TOKEN',
                '-e AWS_ACCESS_KEY_ID',
                '-e AWS_SECRET_ACCESS_KEY',
                '-e AWS_DEFAULT_REGION',
                '-e AWS_REGION',
                '--rm $IMAGE $CMD',
              ].join(' '),
            ],
          },
        }
      })
    })

    this.codeBuild.addToRolePolicy(new PolicyStatement({
      actions: [ 'ecr:GetAuthorizationToken' ],
      resources: [ '*' ],
    }))

    this.codeBuild.addToRolePolicy(new PolicyStatement({
      actions: [ 'sts:AssumeRole' ],
      resources: [ 'deploy', 'file-publishing', 'image-publishing', 'lookup' ]
        .map(type =>
          [
            'arn', this.partition, 'iam', '', Aws.ACCOUNT_ID,
            `role/cdk-hnb659fds-${type}-role-${Aws.ACCOUNT_ID}-${Aws.REGION}`,
          ].join(':')
        ),
    }))

    // grant role access to secret
    this.codeBuild.addToRolePolicy(new PolicyStatement({
      actions: [ 'secretsmanager:GetSecretValue' ],
      resources: [
        [
          `arn:${this.partition}:secretsmanager:${this.region}:`,
          `${Aws.ACCOUNT_ID}:secret:`,
          `${this.config.project}/${this.config.appName}/*`,
        ].join(''),
      ],
    }))

    if (!this.codeBuild.role) {
      throw Error('No role found on codeBuild project instance')
    }

    this.stateStack.deployerEcrRepo.grantPull(this.codeBuild.role)
  }
}
