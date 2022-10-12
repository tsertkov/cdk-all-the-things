import { Construct } from 'constructs'
import { Arn, ArnFormat, Aws } from 'aws-cdk-lib'
import { NestedStackBase, NestedStackBaseProps } from '../../lib/nested-stack-base'
import { StateStack } from './state-stack'
import { DeployerGlStageProps } from './deployer-gl-config'
import { Artifact, Pipeline } from 'aws-cdk-lib/aws-codepipeline'
import { BuildSpec, LinuxBuildImage, PipelineProject } from 'aws-cdk-lib/aws-codebuild'
import { PolicyStatement } from 'aws-cdk-lib/aws-iam'
import { Action, CodeBuildAction, ManualApprovalAction, S3SourceAction, S3Trigger } from 'aws-cdk-lib/aws-codepipeline-actions'
import { deterministicName, regionToCode } from '../../lib/utils'

export interface DeployerGlStackProps extends NestedStackBaseProps {
  readonly stateStack: StateStack
}

export class DeployerGlStack extends NestedStackBase {
  readonly config: DeployerGlStageProps
  readonly stateStack: StateStack
  readonly githubOidcProviderArn: string
  readonly codePipelines: Pipeline[] = []
  codeBuildRo: PipelineProject
  codeBuildRw: PipelineProject
  sdPipeline: Pipeline

  constructor(scope: Construct, id: string, props: DeployerGlStackProps) {
    super(scope, id, props)
    this.stateStack = props.stateStack

    this.initCodeBuildRo()
    this.initCodeBuildRw()
    this.initPipelines()
  }

  private initPipelines () {
    // codepipeline pipelines for each app & regions within current stage
    this.config.appModules.forEach(appName => {
      this.codePipelines.push(
        this.initCodePipeline(
          this.config.rootConfig.stageConfig(this.config.stageName, appName) as DeployerGlStageProps,
          this.config.noApprovalDeploy,
        )
      )
    })
  }

  private initCodePipeline (props: DeployerGlStageProps, noApprovalDeploy: boolean): Pipeline {
    // init deployment code pipeline for given app & regions
    const {
      project,
      appName,
      stageName,
      regions,
    } = props

    const pipelineName = `${project}-${stageName}-${appName}`
    const configArtifact = new Artifact(pipelineName)
    const bucketKey = `${appName}.zip`

    const environmentVariables = {
      CMD: { value: 'ls' },
      REGION: { value: '*' },
      APP: { value: appName },
      STAGE: { value: stageName },
    }

    const sourceAction = new S3SourceAction({
      bucketKey,
      actionName: bucketKey,
      bucket: this.stateStack.artifactsBucket,
      output: configArtifact,
      trigger: S3Trigger.NONE,
    })

    let runOrder = 0
    const deployActions: Action[] = []

    // optional diff & approval actions
    if (!noApprovalDeploy) {
      runOrder++
      deployActions.push(
        ...regions.map(region => {
          const regname = regionToCode(region)
          return new CodeBuildAction({
            runOrder,
            actionName: `diff-${regname}`,
            project: this.codeBuildRo,
            input: configArtifact,
            environmentVariables: {
              ...environmentVariables,
              CMD: {
                value: 'diff',
              },
              REGION: {
                value: regname,
              },
            },
          })
        })
      )

      runOrder++
      deployActions.push(new ManualApprovalAction({
        runOrder,
        actionName: `approve-deploy`,
      }))
    }

    // deployment actions
    runOrder++
    deployActions.push(...regions.map(region => {
      const regname = regionToCode(region)
      return new CodeBuildAction({
        runOrder,
        actionName: `deploy-${regname}`,
        project: this.codeBuildRw,
        input: configArtifact,
        environmentVariables: {
          ...environmentVariables,
          CMD: {
            value: 'deploy',
          },
          REGION: {
            value: regname,
          },
        },
      })
    }))

    return new Pipeline(this, `${appName}-${stageName}-pipeline`, {
      pipelineName,
      artifactBucket: this.stateStack.artifactsBucket,
      stages: [{
        stageName: 'read-config',
        actions: [ sourceAction ],
      }, {
        stageName: `deploy-${stageName}-${appName}`,
        actions: deployActions,
      }],
    })
  }

  private createCodeBuild(rw: boolean) {
    const projectName = deterministicName({
      region: null,
      append: rw ? 'rw' : 'ro',
    }, this)

    const codeBuild = new PipelineProject(this, `CodeBuild-${rw ? 'rw' : 'ro'}`, {
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
              'export IMAGE=${DEPLOYER_IMAGE}:$(cat $APP)',
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
                '--rm $IMAGE app="$APP" stage="$STAGE" region="$REGION" $CMD',
              ].join(' '),
            ],
          },
        }
      })
    })

    codeBuild.addToRolePolicy(new PolicyStatement({
      actions: [ 'ecr:GetAuthorizationToken' ],
      resources: [ '*' ],
    }))

    const cdkRoleTypes = rw
      ? [ 'deploy', 'file-publishing', 'image-publishing', 'lookup' ]
      : [ 'lookup' ]

    codeBuild.addToRolePolicy(new PolicyStatement({
      actions: [ 'sts:AssumeRole' ],
      resources: cdkRoleTypes
        .map(type =>
          Arn.format({
            region: '',
            service: 'iam',
            resource: 'role',
            resourceName: `cdk-hnb659fds-${type}-role-${Aws.ACCOUNT_ID}-*`,
          }, this)
        ),
    }))

    // grant role access to secret
    codeBuild.addToRolePolicy(new PolicyStatement({
      actions: [
        'secretsmanager:GetSecretValue',
        'secretsmanager:DescribeSecret',
      ],
      resources: [
        Arn.format({
          service: 'secretsmanager',
          resource: 'secret',
          arnFormat: ArnFormat.COLON_RESOURCE_NAME,
          resourceName: `${this.config.project}/age-key`,
        }, this),
      ],
    }))

    if (!codeBuild.role) {
      throw Error('No role found on codeBuild project instance')
    }

    this.stateStack.deployerEcrRepo.grantPull(codeBuild.role)

    if (rw) {
      // grant role access to create and update app secrets
      codeBuild.addToRolePolicy(new PolicyStatement({
        actions: [
          'secretsmanager:UpdateSecret',
          'secretsmanager:CreateSecret',
        ],
        resources: [
          Arn.format({
            region: '*',
            service: 'secretsmanager',
            resource: 'secret',
            arnFormat: ArnFormat.COLON_RESOURCE_NAME,
            resourceName: `${this.config.project}/${this.config.stageName}/*`,
          }, this),
        ],
      }))
    }

    return codeBuild
  }

  private initCodeBuildRo () {
    this.codeBuildRo = this.createCodeBuild(false)
  }

  private initCodeBuildRw () {
    this.codeBuildRw = this.createCodeBuild(true)
  }
}