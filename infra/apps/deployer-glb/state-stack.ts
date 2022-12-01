import { Arn, ArnFormat, Fn } from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import {
  ArnPrincipal,
  FederatedPrincipal,
  PolicyStatement,
  Role,
} from 'aws-cdk-lib/aws-iam'
import { IRepository, Repository } from 'aws-cdk-lib/aws-ecr'
import { LogGroup } from 'aws-cdk-lib/aws-logs'
import {
  NestedStackBase,
  NestedStackBaseProps,
} from '../../lib/nested-stack-base.js'
import { deterministicName } from '../../lib/utils.js'
import type { DeployerGlbStageProps } from './deployer-glb-config.js'

const CI_ROLE_NAME = 'CiRole'

interface StateStackProps extends NestedStackBaseProps {
  readonly config: DeployerGlbStageProps
}

export class StateStack extends NestedStackBase {
  override readonly config: DeployerGlbStageProps
  readonly githubOidcProviderArn: string
  readonly ciRole: Role
  readonly deployerEcrRepo: IRepository
  readonly deployerLogGroup: LogGroup

  constructor(scope: Construct, id: string, props: StateStackProps) {
    super(scope, id, props)
    this.config = props.config

    this.githubOidcProviderArn = Fn.importValue(
      this.config.githubOidcArnCfnOutput
    )

    this.deployerEcrRepo = this.initDeployerEcrRepo()
    this.deployerLogGroup = this.initDeployerLogGroup()
    this.ciRole = this.initCiRole()

    if (this.config.nextStage) {
      this.initCiRolePromotionGrants(this.config.nextStage)
    }
  }

  private initDeployerLogGroup() {
    return new LogGroup(this, 'DeployerLogGroup', {
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

    const ciRole = new Role(this, CI_ROLE_NAME, {
      roleName: deterministicName(
        { name: CI_ROLE_NAME, app: null, region: null },
        this
      ),
      assumedBy: githubPrincipal,
    })

    // grant permission to push container images to ecr
    ciRole.addToPolicy(
      new PolicyStatement({
        actions: ['ecr:GetAuthorizationToken'],
        resources: ['*'],
      })
    )

    this.deployerEcrRepo.grantPullPush(ciRole)

    // grant pull access to src image if it is on a different aws account
    if (this.config.prevStage) {
      const prevStageConfig = this.config.rootConfig.stageConfig(
        this.config.prevStage,
        this.config.appName
      )

      if (prevStageConfig.account !== this.account) {
        ciRole.addToPolicy(
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

    // allow starting statemachine execution
    ciRole.addToPolicy(
      new PolicyStatement({
        actions: ['states:StartExecution'],
        resources: [
          Arn.format(
            {
              service: 'states',
              resource: 'stateMachine',
              arnFormat: ArnFormat.COLON_RESOURCE_NAME,
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

    // allow monitoring and stopping statemachine execution
    ciRole.addToPolicy(
      new PolicyStatement({
        actions: ['states:DescribeExecution', 'states:StopExecution'],
        resources: [
          Arn.format(
            {
              service: 'states',
              resource: 'execution',
              arnFormat: ArnFormat.COLON_RESOURCE_NAME,
              resourceName:
                deterministicName(
                  {
                    region: null,
                    app: null,
                    name: 'Deployer',
                  },
                  this
                ) + ':*',
            },
            this
          ),
        ],
      })
    )

    return ciRole
  }

  private initDeployerEcrRepo() {
    return Repository.fromRepositoryName(
      this,
      'DeployerEcrRepo',
      this.deployerRepoName(this.config.stageName)
    )
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
