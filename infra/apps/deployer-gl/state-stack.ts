import { Arn, ArnFormat, Duration, Fn, RemovalPolicy } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { FederatedPrincipal, PolicyStatement, Role } from 'aws-cdk-lib/aws-iam'
import { Bucket } from 'aws-cdk-lib/aws-s3'
import { Repository } from 'aws-cdk-lib/aws-ecr'
import {
  NestedStackBase,
  NestedStackBaseProps,
} from '../../lib/nested-stack-base'
import { DeployerGlStageProps } from './deployer-gl-config'
import { LogGroup } from 'aws-cdk-lib/aws-logs'
import { deterministicName } from '../../lib/utils'

export class StateStack extends NestedStackBase {
  readonly config: DeployerGlStageProps
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
    const federatedPrincipal = new FederatedPrincipal(
      this.githubOidcProviderArn,
      {
        StringEqualsIgnoreCase: {
          'token.actions.githubusercontent.com:sub': githubSub,
        },
      },
      'sts:AssumeRoleWithWebIdentity'
    )

    this.ciRole = new Role(this, 'CiRole', {
      assumedBy: federatedPrincipal,
    })

    // grant permission to write to artifacts bucket
    this.artifactsBucket.grantWrite(this.ciRole)

    // grant permission to push container images to ecr
    this.ciRole.addToPolicy(
      new PolicyStatement({
        actions: ['ecr:GetAuthorizationToken'],
        resources: ['*'],
      })
    )

    const pipelineName = `${this.config.project}-${this.config.stageName}-*`
    this.ciRole.addToPolicy(
      new PolicyStatement({
        actions: [
          'codepipeline:StartPipelineExecution',
          'codepipeline:GetPipelineExecution',
          'codepipeline:StopPipelineExecution',
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

    this.deployerEcrRepo.grantPullPush(this.ciRole)

    if (this.config.promotionSrc) {
      // grant pull access to promotionSrc repo
      this.ciRole.addToPolicy(
        new PolicyStatement({
          actions: [
            'ecr:BatchCheckLayerAvailability',
            'ecr:BatchGetImage',
            'ecr:GetDownloadUrlForLayer',
          ],
          resources: [
            Arn.format(
              {
                service: 'ecr',
                resource: 'repository',
                resourceName: this.deployerRepoName(this.config.promotionSrc),
              },
              this
            ),
          ],
        })
      )
    }
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
