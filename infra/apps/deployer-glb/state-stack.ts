import { Arn, Fn } from 'aws-cdk-lib'
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

const CI_ROLE_NAME = 'CiRole'

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

    this.initDeployerEcrRepo()
    this.initDeployerLogGroup()
    this.initCiRole()

    if (this.config.nextStage) {
      this.initCiRolePromotionGrants(this.config.nextStage)
    }
  }

  private initDeployerLogGroup() {
    this.deployerLogGroup = new LogGroup(this, 'DeployerLogGroup', {
      retention: this.config.logRetentionDays,
      removalPolicy: this.config.removalPolicy,
    })
  }

  private initCiRolePromotionGrants(nextStage: string) {
    const nextStageConfig = this.config.rootConfig.stageConfig(
      nextStage,
      this.config.appName
    )

    const nextStageRoleName = deterministicName(
      {
        name: CI_ROLE_NAME,
        stage: nextStage,
        region: null,
        app: null,
      },
      this
    )

    const nextStageRoleArn = Arn.format(
      {
        account: nextStageConfig.account || this.account,
        region: '',
        service: 'iam',
        resource: 'role',
        resourceName: nextStageRoleName,
      },
      this
    )

    // grant pulling container images to next stage ci role
    this.deployerEcrRepo.addToResourcePolicy(
      new PolicyStatement({
        sid: 'PromotionPolicy',
        actions: ['ecr:BatchGetImage', 'ecr:GetDownloadUrlForLayer'],
        principals: [new ArnPrincipal(nextStageRoleArn)],
      })
    )
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

    this.ciRole = new Role(this, CI_ROLE_NAME, {
      roleName: deterministicName(
        { name: CI_ROLE_NAME, app: null, region: null },
        this
      ),
      assumedBy: githubPrincipal,
    })

    // grant permission to push container images to ecr
    this.ciRole.addToPolicy(
      new PolicyStatement({
        actions: ['ecr:GetAuthorizationToken'],
        resources: ['*'],
      })
    )

    this.deployerEcrRepo.grantPullPush(this.ciRole)

    // grant pull access to src image if it is on a different aws account
    if (this.config.prevStage) {
      const prevStageConfig = this.config.rootConfig.stageConfig(
        this.config.prevStage,
        this.config.appName
      )

      if (prevStageConfig.account !== this.account) {
        this.ciRole.addToPolicy(
          new PolicyStatement({
            actions: ['ecr:BatchGetImage', 'ecr:GetDownloadUrlForLayer'],
            resources: [
              Arn.format(
                {
                  account: prevStageConfig.account,
                  service: 'ecr',
                  resource: 'repository',
                  resourceName: this.deployerRepoName(this.config.prevStage),
                },
                this
              ),
            ],
          })
        )
      }
    }

    // allow starting and monitoring statemachine execution
    this.ciRole.addToPolicy(
      new PolicyStatement({
        actions: [
          'states:StartExecution',
          'states:DescribeExecution',
          'states:StopExecution',
        ],
        resources: [
          Arn.format(
            {
              service: 'states',
              resource: 'stateMachine',
              resourceName: deterministicName(
                {
                  region: null,
                  app: null,
                  name: 'Deployer',
                },
                this
              ),
            },
            this
          ),
        ],
      })
    )
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
