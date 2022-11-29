import type { Construct } from 'constructs'
import { CfnOutput } from 'aws-cdk-lib'
import { deterministicName } from '../../lib/utils.js'
import { StackBase, StackBaseProps } from '../../lib/stack-base.js'
import { StateStack } from './state-stack.js'
import { DeployerGlbStack } from './deployer-glb-stack.js'
import type { DeployerGlbStageProps } from './deployer-glb-config.js'

interface DeployerGlbAppStackProps extends StackBaseProps {
  readonly config: DeployerGlbStageProps
}

export class DeployerGlbAppStack extends StackBase {
  override readonly config: DeployerGlbStageProps
  readonly stateStack: StateStack
  readonly deployerStack: DeployerGlbStack

  constructor(scope: Construct, id: string, props: DeployerGlbAppStackProps) {
    super(scope, id, props)
    this.config = props.config

    this.stateStack = new StateStack(this, 'State', {
      config: props.config,
    })

    this.deployerStack = new DeployerGlbStack(this, 'Deployer', {
      config: props.config,
      stateStack: this.stateStack,
    })

    this.initOutputs()
  }

  private initOutputs() {
    new CfnOutput(this, 'CiRoleArn', {
      value: this.stateStack.ciRole.roleArn,
      exportName: deterministicName({ name: 'CiRoleArn' }, this),
    })

    new CfnOutput(this, 'DeployerEcrRepoUri', {
      value: this.stateStack.deployerEcrRepo.repositoryUri,
      exportName: deterministicName({ name: 'DeployerEcrRepoUri' }, this),
    })
  }
}
