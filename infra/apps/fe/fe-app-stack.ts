import type { Construct } from 'constructs'
import { CfnOutput, RemovalPolicy } from 'aws-cdk-lib'
import { Bucket } from 'aws-cdk-lib/aws-s3'
import { StackBase, StackBaseProps } from '../../lib/stack-base.js'
import { deterministicName } from '../../lib/utils.js'
import type { FeStageProps } from './fe-config.js'

interface FeAppStackProps extends StackBaseProps {
  readonly config: FeStageProps
}

export class FeAppStack extends StackBase {
  override readonly config: FeStageProps
  readonly webBucket: Bucket

  constructor(scope: Construct, id: string, props: FeAppStackProps) {
    super(scope, id, props)
    this.config = props.config
    this.webBucket = this.initWebBucket()
    this.initOutputs()
  }

  private initWebBucket() {
    return new Bucket(this, 'WebBucket', {
      autoDeleteObjects: this.config.removalPolicy === RemovalPolicy.DESTROY,
      removalPolicy: this.config.removalPolicy,
    })
  }

  private initOutputs() {
    new CfnOutput(this, 'WebBucketName', {
      value: this.webBucket.bucketName,
      exportName: deterministicName({ name: 'WebBucketName' }, this),
    })
  }
}
