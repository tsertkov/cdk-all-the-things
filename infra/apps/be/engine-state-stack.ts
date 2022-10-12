import { Construct } from 'constructs'
import { Queue } from 'aws-cdk-lib/aws-sqs'
import { NestedStackBase, NestedStackBaseProps } from '../../lib/nested-stack-base'
import { BeStageProps } from './be-config'

export interface EngineStateStackProps extends NestedStackBaseProps {
}

export class EngineStateStack extends NestedStackBase {
  protected readonly config: BeStageProps
  jobQueue: Queue
  jobQueueDlq: Queue

  constructor(scope: Construct, id: string, props: EngineStateStackProps) {
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
