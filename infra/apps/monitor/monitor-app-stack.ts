import { Construct } from 'constructs'
import { deterministicName, setNameTag } from '../../lib/utils'
import { StackBase, StackBaseProps } from '../../lib/stack-base'
import { StateStack } from './state-stack'
import { LogStack } from './log-stack'
import { CfnOutput } from 'aws-cdk-lib'

export interface MonitorAppStackProps extends StackBaseProps {}

export class MonitorAppStack extends StackBase {
  stateStack: StateStack
  logStack: LogStack

  constructor(scope: Construct, id: string, props: MonitorAppStackProps) {
    super(scope, id, props)
    this.initNestedStacks(props)
    this.initOutputs()
  }

  private initNestedStacks(props: MonitorAppStackProps) {
    this.stateStack = new StateStack(this, 'StateState', {
      config: props.config,
    })

    setNameTag(this.stateStack, 'StateStack')

    this.logStack = new LogStack(this, 'Log', {
      config: props.config,
      stateStack: this.stateStack,
    })

    setNameTag(this.logStack, 'LogStack')
  }

  private initOutputs() {
    new CfnOutput(this, 'LogDeliveryStreamArn', {
      value: this.logStack.deliveryStream.attrArn,
      exportName: deterministicName(this, 'LogDeliveryStreamArn'),
    })
  }
}
