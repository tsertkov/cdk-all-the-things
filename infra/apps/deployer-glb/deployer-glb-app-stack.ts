import { Construct } from 'constructs'
import { CfnOutput } from 'aws-cdk-lib'
import { deterministicName } from '../../lib/utils'
import { StackBase, StackBaseProps } from '../../lib/stack-base'
import { StateStack } from './state-stack'
import { DeployerGlbStack } from './deployer-glb-stack'
import { DeployerGlbStageProps } from './deployer-glb-config'

export class DeployerGlbAppStack extends StackBase {
  readonly config: DeployerGlbStageProps
  stateStack: StateStack
  deployerStack: DeployerGlbStack

  constructor(scope: Construct, id: string, props: StackBaseProps) {
    super(scope, id, props)
    this.initNestedStacks(props)
    this.initOutputs()
  }

  private initNestedStacks(props: StackBaseProps) {
    this.stateStack = new StateStack(this, 'State', {
      config: props.config,
    })

    this.deployerStack = new DeployerGlbStack(this, 'Deployer', {
      config: props.config,
      stateStack: this.stateStack,
    })
  }

  private initOutputs() {
    new CfnOutput(this, 'CiRoleName', {
      value: this.stateStack.ciRole.roleName,
      exportName: deterministicName({ name: 'CiRoleName' }, this),
    })

    new CfnOutput(this, 'DeployerEcrRepoUri', {
      value: this.stateStack.deployerEcrRepo.repositoryUri,
      exportName: deterministicName({ name: 'DeployerEcrRepoUri' }, this),
    })

    new CfnOutput(this, 'ArtifactsBucketName', {
      value: this.stateStack.artifactsBucket.bucketName,
      exportName: deterministicName({ name: 'ArtifactsBucketName' }, this),
    })
  }
}
