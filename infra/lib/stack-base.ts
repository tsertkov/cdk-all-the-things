import { Construct } from 'constructs'
import { Stack, StackProps } from 'aws-cdk-lib'
import { StageProps } from './config'

export interface StackBaseProps {
  readonly stackProps?: StackProps
  readonly config: StageProps
}

export class StackBase extends Stack {
  protected readonly config: StageProps

  constructor(scope: Construct, id: string, props: StackBaseProps) {
    super(scope, id, props.stackProps)
    this.config = props.config
  }
}
