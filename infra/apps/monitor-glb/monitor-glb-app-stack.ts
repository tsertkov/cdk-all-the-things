import { Construct } from 'constructs'
import { Aws, CfnOutput, RemovalPolicy } from 'aws-cdk-lib'
import { Bucket } from 'aws-cdk-lib/aws-s3'
import { StackBase, StackBaseProps } from '../../lib/stack-base'
import { deterministicName } from '../../lib/utils'
import { MonitorGlbStageProps } from './monitor-glb-config'

export class MonitorGlbAppStack extends StackBase {
  readonly config: MonitorGlbStageProps
  logsBucket: Bucket

  constructor(scope: Construct, id: string, props: StackBaseProps) {
    super(scope, id, props)
    this.initLogsBucket()
    this.initOutputs()
  }

  private initLogsBucket() {
    const bucketName =
      deterministicName(
        {
          name: this.config.logsBucketName,
          app: null,
          region: null,
        },
        this
      ).toLowerCase() +
      '-' +
      Aws.ACCOUNT_ID

    this.logsBucket = new Bucket(this, 'LogsBucket', {
      bucketName,
      autoDeleteObjects: this.config.removalPolicy === RemovalPolicy.DESTROY,
      removalPolicy: this.config.removalPolicy,
    })
  }

  private initOutputs() {
    new CfnOutput(this, 'LogsBucketName', {
      value: this.logsBucket.bucketName,
      exportName: deterministicName({ name: 'LogsBucketName' }, this),
    })
  }
}
