import { Aws, Fn, RemovalPolicy } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { FederatedPrincipal, PolicyStatement, Role } from 'aws-cdk-lib/aws-iam'
import { Bucket } from 'aws-cdk-lib/aws-s3'
import { Repository } from 'aws-cdk-lib/aws-ecr'
import { NestedStackBase, NestedStackBaseProps } from '../../lib/nested-stack-base'
import { DeployerStageProps } from './deployer-config'
import { LogGroup } from 'aws-cdk-lib/aws-logs'

export interface StateStackProps extends NestedStackBaseProps {
}

export class StateStack extends NestedStackBase {
  protected readonly config: DeployerStageProps
  readonly githubOidcProviderArn: string
  ciRole: Role
  artifactsBucket: Bucket
  deployerEcrRepo: Repository
  deployerLogGroup: LogGroup

  constructor(scope: Construct, id: string, props: StateStackProps) {
    super(scope, id, props)

    this.githubOidcProviderArn = Fn.importValue(this.config.githubOidcArnCfnOutput)

    this.initArtifactsBucket()
    this.initDeployerEcrRepo()
    this.initDeployerLogGroup()
    this.initCiRole()
  }

  private initDeployerLogGroup () {
    this.deployerLogGroup = new LogGroup(this, 'DeployerLogGroup', {
      retention: this.config.logRetentionDays,
      removalPolicy: this.config.removalPolicy,
    })
  }

  private initCiRole () {
    const githubSub = `repo:${this.config.githubRepo}:environment:${this.config.stageName}`
    const federatedPrincipal = new FederatedPrincipal(this.githubOidcProviderArn, {
      StringEqualsIgnoreCase: {
        'token.actions.githubusercontent.com:sub': githubSub,
      },
    }, 'sts:AssumeRoleWithWebIdentity')

    this.ciRole = new Role(this, 'CiRole', {
      assumedBy: federatedPrincipal,
    })

    // grant permission to write to artifacts bucket
    this.artifactsBucket.grantWrite(this.ciRole)

    // grant permission to push container images to ecr
    this.ciRole.addToPolicy(new PolicyStatement({
      actions: [ 'ecr:GetAuthorizationToken'],
      resources: [ '*' ],
    }))

    const pipelineName = `${this.config.project}-${this.config.stageName}-*`
    this.ciRole.addToPolicy(new PolicyStatement({
      actions: [
        'codepipeline:StartPipelineExecution',
        'codepipeline:GetPipelineExecution',
        'codepipeline:StopPipelineExecution',
      ],
      resources: [ `arn:${this.partition}:codepipeline:${this.region}:${Aws.ACCOUNT_ID}:${pipelineName}` ],
    }))

    this.deployerEcrRepo.grantPullPush(this.ciRole)

    if (this.config.promotionSrc) {
      // grant pull access to promotionSrc repo
      this.ciRole.addToPolicy(new PolicyStatement({
        actions: [
          'ecr:BatchCheckLayerAvailability',
          'ecr:BatchGetImage',
          'ecr:GetDownloadUrlForLayer',
        ],
        resources: [
          `arn:${this.partition}:ecr:${this.region}:${Aws.ACCOUNT_ID}:repository/${this.deployerRepoName(this.config.promotionSrc)}`,
        ],
      }))
    }
  }

  private initArtifactsBucket () {
    const autoDeleteObjects = this.config.removalPolicy === RemovalPolicy.DESTROY
    this.artifactsBucket = new Bucket(this, 'ArtifactsBucket', {
      removalPolicy: this.config.removalPolicy,
      autoDeleteObjects,
      versioned: true,
    })
  }

  private initDeployerEcrRepo() {
    this.deployerEcrRepo = new Repository(this, 'DeployerEcrRepo', {
      repositoryName: this.deployerRepoName(this.config.stageName),
      removalPolicy: this.config.removalPolicy,
    })
  }

  private deployerRepoName(stageName: string) {
    return [
      this.config.project.toLowerCase(),
      stageName,
      'deployer',
    ].join('-')
  }
}
