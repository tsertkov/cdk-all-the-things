import { Construct } from 'constructs'
import { CfnOutput, RemovalPolicy } from 'aws-cdk-lib'
import { Bucket } from 'aws-cdk-lib/aws-s3'
import { StackBase, StackBaseProps } from '../../lib/stack-base'
import { deterministicName } from '../../lib/utils'
import { FeStageProps } from './fe-config'

export class FeAppStack extends StackBase {
  readonly config: FeStageProps
  webBucket: Bucket

  constructor(scope: Construct, id: string, props: StackBaseProps) {
    super(scope, id, props)
    this.initWebBucket()
    this.initOutputs()
  }

  private initWebBucket() {
    this.webBucket = new Bucket(this, 'WebBucket', {
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
