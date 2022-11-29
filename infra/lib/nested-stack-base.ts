import type { Construct } from 'constructs'
import { NestedStack } from 'aws-cdk-lib'
import type { StageProps } from './config.js'
import type { StackBaseProps } from './stack-base.js'

export { StackBaseProps as NestedStackBaseProps }

export class NestedStackBase extends NestedStack {
  readonly config: StageProps

  constructor(scope: Construct, id: string, props: StackBaseProps) {
    super(scope, id, props.stackProps)
    this.config = props.config
  }
}
