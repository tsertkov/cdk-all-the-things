import { Construct } from 'constructs'
import { Queue } from 'aws-cdk-lib/aws-sqs'
import { NestedStackBase, NestedStackBaseProps } from '../../lib/nested-stack-base'
import { BeStageProps } from './be-config'

export class EngineStateStack extends NestedStackBase {
  readonly config: BeStageProps
  jobQueue: Queue
  jobQueueDlq: Queue

  constructor(scope: Construct, id: string, props: NestedStackBaseProps) {
    super(scope, id, props)
    this.initJobQueue()
  }

  private initJobQueue() {
    this.jobQueueDlq = new Queue(this, 'JobQueueDlq')
    this.jobQueue = new Queue(this, 'JobQueue', {
      deadLetterQueue: {
        queue: this.jobQueueDlq,
        maxReceiveCount: 3,
      }
    })
  }
}
