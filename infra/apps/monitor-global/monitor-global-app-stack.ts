import { Construct } from 'constructs'
import { deterministicName, setNameTag } from '../../lib/utils'
import { StackBase, StackBaseProps } from '../../lib/stack-base'
import { Aws, CfnOutput, RemovalPolicy } from 'aws-cdk-lib'
import { Bucket } from 'aws-cdk-lib/aws-s3'
import { MonitorGlobalStageProps } from './monitor-global-config'

export interface MonitorGlobalAppStackProps extends StackBaseProps {}

export class MonitorGlobalAppStack extends StackBase {
  protected readonly config: MonitorGlobalStageProps
  logsBucket: Bucket

  constructor(scope: Construct, id: string, props: MonitorGlobalAppStackProps) {
    super(scope, id, props)
    this.initLogsBucket()
    this.initOutputs()

    setNameTag(this, 'MonitorGlobalAppStack')
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
