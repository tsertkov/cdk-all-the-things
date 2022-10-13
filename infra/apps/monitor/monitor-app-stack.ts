import { Construct } from 'constructs'
import { deterministicName } from '../../lib/utils'
import { StackBase, StackBaseProps } from '../../lib/stack-base'
import { StateStack } from './state-stack'
import { LogStack } from './log-stack'
import { CfnOutput } from 'aws-cdk-lib'

export class MonitorAppStack extends StackBase {
  stateStack: StateStack
  logStack: LogStack

  constructor(scope: Construct, id: string, props: StackBaseProps) {
    super(scope, id, props)
    this.initNestedStacks(props)
    this.initOutputs()
  }

  private initNestedStacks(props: StackBaseProps) {
    this.stateStack = new StateStack(this, 'StateState', {
      config: props.config,
    })

    this.logStack = new LogStack(this, 'Log', {
      config: props.config,
      stateStack: this.stateStack,
    })
  }

  private initOutputs() {
    new CfnOutput(this, 'LogDeliveryStreamArn', {
      value: this.logStack.deliveryStream.attrArn,
      exportName: deterministicName({ name: 'LogDeliveryStreamArn' }, this),
    })
  }
}
