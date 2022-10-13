import { Construct } from 'constructs'
import { NestedStack } from 'aws-cdk-lib'
import { StageProps } from './config'
import { StackBaseProps } from './stack-base'

export { StackBaseProps as NestedStackBaseProps }

export class NestedStackBase extends NestedStack {
  readonly config: StageProps

  constructor(scope: Construct, id: string, props: StackBaseProps) {
    super(scope, id, props.stackProps)
    this.config = props.config
  }
}
