import { Construct } from 'constructs'
import { deterministicName, setNameTag } from '../../lib/utils'
import { StackBase, StackBaseProps } from '../../lib/stack-base'
import { StateStack } from './state-stack'
import { DeployerStack } from './deployer-stack'
import { CfnOutput } from 'aws-cdk-lib'
import { DeployerStageProps } from './deployer-config'

export interface DeployerAppStackProps extends StackBaseProps {}

export class DeployerAppStack extends StackBase {
  protected readonly config: DeployerStageProps
  stateStack: StateStack
  deployerStack: DeployerStack

  constructor(scope: Construct, id: string, props: DeployerAppStackProps) {
    super(scope, id, props)
    this.initNestedStacks(props)
    this.initOutputs()
  }

  private initNestedStacks(props: DeployerAppStackProps) {
    this.stateStack = new StateStack(this, 'State', {
      config: props.config,
    })

    setNameTag(this.stateStack, 'StateStack')

    this.deployerStack = new DeployerStack(this, 'Deployer', {
      config: props.config,
      stateStack: this.stateStack,
    })

    setNameTag(this.deployerStack, 'DeployerStack')
  }

  private initOutputs() {
    new CfnOutput(this, 'CiRoleArn', {
      value: this.stateStack.ciRole.roleArn,
      exportName: deterministicName(this, 'CiRoleArn'),
    })

    new CfnOutput(this, 'DeployerEcrRepoUri', {
      value: this.stateStack.deployerEcrRepo.repositoryUri,
      exportName: deterministicName(this, 'DeployerEcrRepoUri'),
    })

    new CfnOutput(this, 'ArtifactsBucketName', {
      value: this.stateStack.artifactsBucket.bucketName,
      exportName: deterministicName(this, 'ArtifactsBucketName'),
    })
  }
}
