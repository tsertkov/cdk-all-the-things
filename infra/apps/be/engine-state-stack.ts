import type { Construct } from 'constructs'
import { Queue } from 'aws-cdk-lib/aws-sqs'
import {
  NestedStackBase,
  NestedStackBaseProps,
} from '../../lib/nested-stack-base.js'
import type { BeStageProps } from './be-config.js'

interface EngineStateStackProps extends NestedStackBaseProps {
  readonly config: BeStageProps
}

export class EngineStateStack extends NestedStackBase {
  override readonly config: BeStageProps
  readonly jobQueue: Queue
  readonly jobQueueDlq: Queue

  constructor(scope: Construct, id: string, props: EngineStateStackProps) {
    super(scope, id, props)
    this.config = props.config

    this.jobQueueDlq = new Queue(this, 'JobQueueDlq')
    this.jobQueue = new Queue(this, 'JobQueue', {
      deadLetterQueue: {
        queue: this.jobQueueDlq,
        maxReceiveCount: 3,
      },
    })
  }
}
