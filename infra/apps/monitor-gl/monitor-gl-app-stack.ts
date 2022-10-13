import { Construct } from 'constructs'
import { deterministicName } from '../../lib/utils'
import { StackBase, StackBaseProps } from '../../lib/stack-base'
import { Aws, CfnOutput, RemovalPolicy } from 'aws-cdk-lib'
import { Bucket } from 'aws-cdk-lib/aws-s3'
import { MonitorGlStageProps } from './monitor-gl-config'

export class MonitorGlAppStack extends StackBase {
  readonly config: MonitorGlStageProps
  logsBucket: Bucket

  constructor(scope: Construct, id: string, props: StackBaseProps) {
    super(scope, id, props)
    this.initLogsBucket()
    this.initOutputs()
  }

  private initLogsBucket () {
    const autoDeleteObjects = this.config.removalPolicy === RemovalPolicy.DESTROY

    const bucketName = deterministicName({
      name: this.config.logsBucketName,
      app: null,
      region: null,
    }, this).toLowerCase() + '-' + Aws.ACCOUNT_ID

    this.logsBucket = new Bucket(this, 'LogsBucket', {
      bucketName,
      autoDeleteObjects,
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
