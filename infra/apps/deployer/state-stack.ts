import { Aws, Fn } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { FederatedPrincipal, PolicyStatement, Role } from 'aws-cdk-lib/aws-iam'
import { Bucket } from 'aws-cdk-lib/aws-s3'
import { Repository } from 'aws-cdk-lib/aws-ecr'
import { NestedStackBase, NestedStackBaseProps } from '../../lib/nested-stack-base'
import { DeployerStageProps } from './deployer-config'
import { LogGroup } from 'aws-cdk-lib/aws-logs'

export interface StateStackProps extends NestedStackBaseProps {
  readonly deploymentArtifactName: string
}

export class StateStack extends NestedStackBase {
  protected readonly config: DeployerStageProps
  readonly githubOidcProviderArn: string
  readonly deploymentArtifactName: string
  ciRole: Role
  artifactsBucket: Bucket
  deployerEcrRepo: Repository
  deployerLogGroup: LogGroup

  constructor(scope: Construct, id: string, props: StateStackProps) {
    super(scope, id, props)

    this.deploymentArtifactName = props.deploymentArtifactName
    this.githubOidcProviderArn = Fn.importValue('GithubOidcArn')

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
    const federatedPrincipal = new FederatedPrincipal(this.githubOidcProviderArn, {
      StringLike: {
        'token.actions.githubusercontent.com:sub': `repo:${this.config.githubRepo}:*`,
      },
    }, 'sts:AssumeRoleWithWebIdentity')

    this.ciRole = new Role(this, 'CiRole', {
      assumedBy: federatedPrincipal,
    })

    // grant permission to write deployment artifact to artifacts bucket
    this.artifactsBucket.grantWrite(this.ciRole, this.deploymentArtifactName)

    // grant permission to push container images to ecr
    this.ciRole.addToPolicy(new PolicyStatement({
      actions: [ 'ecr:GetAuthorizationToken'],
      resources: [ '*' ],
    }))

    // grant permission to trigger codepipeline for dev stage only
    if (this.config.stageName === 'dev') {
      this.ciRole.addToPolicy(new PolicyStatement({
        actions: [ 'codepipeline:StartPipelineExecution' ],
        resources: [ `arn:${this.partition}:codepipeline:${this.region}:${Aws.ACCOUNT_ID}:CdkGoLambdas-deployer-dev` ],
      }))
    }

    this.deployerEcrRepo.grantPullPush(this.ciRole)
  }

  private initArtifactsBucket () {
    this.artifactsBucket = new Bucket(this, 'ArtifactsBucket', {
      removalPolicy: this.config.removalPolicy,
      versioned: true,
    })
  }

  private initDeployerEcrRepo() {
    const repositoryName = [
      this.config.project.toLowerCase(),
      this.config.stageName,
      'deployer',
    ].join('-')

    this.deployerEcrRepo = new Repository(this, 'DeployerEcrRepo', {
      repositoryName,
      removalPolicy: this.config.removalPolicy,
    })
  }
}
