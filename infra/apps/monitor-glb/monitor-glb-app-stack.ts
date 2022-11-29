import type { Construct } from 'constructs'
import { Aws, CfnOutput, RemovalPolicy } from 'aws-cdk-lib'
import { Bucket } from 'aws-cdk-lib/aws-s3'
import { StackBase, StackBaseProps } from '../../lib/stack-base.js'
import { deterministicName } from '../../lib/utils.js'
import type { MonitorGlbStageProps } from './monitor-glb-config.js'

interface MonitorGlbAppStackProps extends StackBaseProps {
  readonly config: MonitorGlbStageProps
}

export class MonitorGlbAppStack extends StackBase {
  override readonly config: MonitorGlbStageProps
  readonly logsBucket: Bucket

  constructor(scope: Construct, id: string, props: MonitorGlbAppStackProps) {
    super(scope, id, props)
    this.config = props.config
    this.logsBucket = this.initLogsBucket()
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

    return new Bucket(this, 'LogsBucket', {
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
