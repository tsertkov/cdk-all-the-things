import { Construct } from 'constructs'
import { deterministicName, setNameTag } from '../../lib/utils'
import { StackBase, StackBaseProps } from '../../lib/stack-base'
import { Aws, CfnOutput, RemovalPolicy } from 'aws-cdk-lib'
import { Bucket } from 'aws-cdk-lib/aws-s3'
import { MonitorGlStageProps } from './monitor-gl-config'

export interface MonitorGlAppStackProps extends StackBaseProps {}

export class MonitorGlAppStack extends StackBase {
  protected readonly config: MonitorGlStageProps
  logsBucket: Bucket

  constructor(scope: Construct, id: string, props: MonitorGlAppStackProps) {
    super(scope, id, props)
    this.initLogsBucket()
    this.initOutputs()
  }

  private initLogsBucket () {
    const autoDeleteObjects = this.config.removalPolicy === RemovalPolicy.DESTROY
    const bucketName = deterministicName(this, this.config.logsBucketName)
      .toLowerCase() + '-' + Aws.ACCOUNT_ID

    this.logsBucket = new Bucket(this, 'LogsBucket', {
      bucketName,
      autoDeleteObjects,
      removalPolicy: this.config.removalPolicy,
    })
  }

  private initOutputs() {
    new CfnOutput(this, 'LogsBucketName', {
      value: this.logsBucket.bucketName,
      exportName: deterministicName(this, 'LogsBucketName'),
    })
  }
}
