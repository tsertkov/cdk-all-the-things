import { Arn, ArnFormat, Aws, Fn, RemovalPolicy } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import {
  ArnPrincipal,
  FederatedPrincipal,
  PolicyStatement,
  Role,
} from 'aws-cdk-lib/aws-iam'
import { Bucket } from 'aws-cdk-lib/aws-s3'
import { Repository } from 'aws-cdk-lib/aws-ecr'
import { LogGroup } from 'aws-cdk-lib/aws-logs'
import {
  NestedStackBase,
  NestedStackBaseProps,
} from '../../lib/nested-stack-base'
import { deterministicName } from '../../lib/utils'
import { DeployerGlbStageProps } from './deployer-glb-config'

export class StateStack extends NestedStackBase {
  readonly config: DeployerGlbStageProps
  readonly githubOidcProviderArn: string
  ciRole: Role
  artifactsBucket: Bucket
  deployerEcrRepo: Repository
  deployerLogGroup: LogGroup

  constructor(scope: Construct, id: string, props: NestedStackBaseProps) {
    super(scope, id, props)

    this.githubOidcProviderArn = Fn.importValue(
      this.config.githubOidcArnCfnOutput
    )

    this.initArtifactsBucket()
    this.initDeployerEcrRepo()
    this.initDeployerLogGroup()
    this.initCiRole()
  }

  private initDeployerLogGroup() {
    this.deployerLogGroup = new LogGroup(this, 'DeployerLogGroup', {
      retention: this.config.logRetentionDays,
      removalPolicy: this.config.removalPolicy,
    })
  }

  private initCiRole() {
    const githubSub = `repo:${this.config.githubRepo}:environment:${this.config.stageName}`
    const githubPrincipal = new FederatedPrincipal(
      this.githubOidcProviderArn,
      {
        StringEqualsIgnoreCase: {
          'token.actions.githubusercontent.com:sub': githubSub,
        },
      },
      'sts:AssumeRoleWithWebIdentity'
    )

    this.ciRole = new Role(this, 'CiRole', {
      roleName: deterministicName(
        { name: 'CiRole', app: null, region: null },
        this
      ),
      assumedBy: githubPrincipal,
    })

    // grant permission to write to artifacts bucket
    this.artifactsBucket.grantWrite(this.ciRole, '*.zip')
    this.artifactsBucket.grantRead(this.ciRole)

    // grant permission to push container images to ecr
    this.ciRole.addToPolicy(
      new PolicyStatement({
        actions: ['ecr:GetAuthorizationToken'],
        resources: ['*'],
      })
    )

    this.deployerEcrRepo.grantPullPush(this.ciRole)

    // allow starting and monitoring pipeline execution
    const pipelineName = `${this.config.project}-${this.config.stageName}-*`
    this.ciRole.addToPolicy(
      new PolicyStatement({
        actions: [
          'codepipeline:StartPipelineExecution',
          'codepipeline:GetPipelineExecution',
          'codepipeline:StopPipelineExecution',
          'codepipeline:ListActionExecutions',
        ],
        resources: [
          Arn.format(
            {
              service: 'codepipeline',
              arnFormat: ArnFormat.NO_RESOURCE_NAME,
              resource: pipelineName,
            },
            this
          ),
        ],
      })
    )
  }

  private initArtifactsBucket() {
    this.artifactsBucket = new Bucket(this, 'ArtifactsBucket', {
      removalPolicy: this.config.removalPolicy,
      autoDeleteObjects: this.config.removalPolicy === RemovalPolicy.DESTROY,
      versioned: true,
    })
  }

  private initDeployerEcrRepo() {
    this.deployerEcrRepo = new Repository(this, 'DeployerEcrRepo', {
      repositoryName: this.deployerRepoName(this.config.stageName),
      removalPolicy: this.config.removalPolicy,
      imageScanOnPush: true,
    })

    this.deployerEcrRepo.addLifecycleRule({
      maxImageCount: this.config.ecrMaxImageCount,
    })

    // grant pull access to next stage deployer role
    if (this.config.nextStageConfig) {
      const account = this.config.nextStageConfig.account || this.account
      const nextStageCiRoleArn = Arn.format({
        account,
        partition: 'aws',
        region: '',
        service: 'iam',
        resource: 'role',
        resourceName: deterministicName(
          {
            name: 'CiRole',
            stage: this.config.nextStage,
            region: null,
            app: null,
          },
          this
        ),
      })

      this.deployerEcrRepo.addToResourcePolicy(
        new PolicyStatement({
          sid: 'PromotionPolicy',
          actions: ['ecr:BatchGetImage', 'ecr:GetDownloadUrlForLayer'],
          principals: [new ArnPrincipal(nextStageCiRoleArn)],
        })
      )
    }
  }

  private deployerRepoName(stageName: string) {
    return deterministicName(
      {
        stage: stageName,
        name: 'deployer',
        region: null,
        app: null,
      },
      this
    ).toLowerCase()
  }
}
