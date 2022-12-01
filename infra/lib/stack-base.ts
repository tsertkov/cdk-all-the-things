import type { Construct } from 'constructs'
import { Stack, StackProps } from 'aws-cdk-lib'
import type { StageProps } from './config.js'

export interface StackBaseProps {
  readonly stackProps?: StackProps
  readonly config: StageProps
}

export class StackBase extends Stack {
  readonly config: StageProps

  constructor(scope: Construct, id: string, props: StackBaseProps) {
    super(scope, id, props.stackProps)
    this.config = props.config
  }
}
