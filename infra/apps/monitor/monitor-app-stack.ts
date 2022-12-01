import type { Construct } from 'constructs'
import { CfnOutput } from 'aws-cdk-lib'
import { deterministicName } from '../../lib/utils.js'
import { StackBase, StackBaseProps } from '../../lib/stack-base.js'
import { StateStack } from './state-stack.js'
import { LogStack } from './log-stack.js'
import type { MonitorStageProps } from './monitor-config.js'

interface MonitorAppStackProps extends StackBaseProps {
  readonly config: MonitorStageProps
}

export class MonitorAppStack extends StackBase {
  override readonly config: MonitorStageProps
  readonly stateStack: StateStack
  readonly logStack: LogStack

  constructor(scope: Construct, id: string, props: MonitorAppStackProps) {
    super(scope, id, props)
    this.config = props.config

    this.stateStack = new StateStack(this, 'StateState', {
      config: this.config,
    })

    this.logStack = new LogStack(this, 'Log', {
      config: this.config,
      stateStack: this.stateStack,
    })

    this.initOutputs()
  }

  private initOutputs() {
    new CfnOutput(this, 'LogDeliveryStreamArn', {
      value: this.logStack.deliveryStream.attrArn,
      exportName: deterministicName({ name: 'LogDeliveryStreamArn' }, this),
    })
  }
}
