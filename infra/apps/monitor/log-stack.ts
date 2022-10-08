import { Construct } from 'constructs'
import { NestedStackBase, NestedStackBaseProps } from '../../lib/nested-stack-base'
import { StateStack } from './state-stack'
import { CfnDeliveryStream } from 'aws-cdk-lib/aws-kinesisfirehose'
import { MonitorStageProps } from './monitor-config'
import { PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam'
import { LogStream } from 'aws-cdk-lib/aws-logs'
import { deterministicName, regionToCode } from '../../lib/utils'
import { Bucket, IBucket } from 'aws-cdk-lib/aws-s3'
import { Aws } from 'aws-cdk-lib'

export interface LogStackProps extends NestedStackBaseProps {
  readonly stateStack: StateStack
}

export class LogStack extends NestedStackBase {
  protected readonly config: MonitorStageProps
  globalLogsBucket: IBucket
  stateStack: StateStack
  deliveryStream: CfnDeliveryStream
  firehoseRole: Role
  subscriptionFilterRole: Role
  deliveryBackupLogStream: LogStream
  deliveryLogStream: LogStream

  constructor(scope: Construct, id: string, props: LogStackProps) {
    super(scope, id, props)
    this.stateStack = props.stateStack

    this.importGlobalLogsBucket()
    this.initFirehoseRole()
    this.initDeliveryStream()
    this.initSubscriptionFilterRole()
  }

  private initSubscriptionFilterRole () {
    const regCode = regionToCode(this.region)
    const logDeliveryStreamName = `${this.config.project}-${this.config.stageName}-${regCode}-monitor-LogDeliveryStream`
    const logDeliveryStreamArn = `arn:${this.partition}:firehose:`
      + `${this.region}:${Aws.ACCOUNT_ID}:deliverystream/`
      + logDeliveryStreamName

    const subscriptionFilterRole = new Role(this, 'SubscriptionFilterRole', {
      roleName: deterministicName(this, 'SubscriptionFilterRole'),
      assumedBy: new ServicePrincipal('logs.amazonaws.com'),
    })

    subscriptionFilterRole.addToPolicy(
      new PolicyStatement({
        actions: [
          'firehose:DescribeDeliveryStream',
          'firehose:PutRecord',
          'firehose:PutRecordBatch',
        ],
        resources: [ logDeliveryStreamArn ],
      }
    ))
  }

  private importGlobalLogsBucket () {
    const logsBucketName = deterministicName(this, this.config.logsBucketName)
      .replace(`-monitor-${this.config.logsBucketName}`, `-monitor-global-${this.config.logsBucketName}`)
      .toLowerCase() + '-' + Aws.ACCOUNT_ID

    this.globalLogsBucket = Bucket.fromBucketName(this, 'LogsBucket', logsBucketName)
  }

  private initFirehoseRole () {
    this.firehoseRole = new Role(this, 'FirehoseRole', {
      assumedBy: new ServicePrincipal('firehose.amazonaws.com'),
    })

    this.stateStack.logDeliveryLogGroup.grantWrite(this.firehoseRole)
    this.globalLogsBucket.grantReadWrite(this.firehoseRole)
  }

  private initDeliveryStream () {
    const deliveryStreamName = deterministicName(this, 'LogDeliveryStream')

    const logDeliveryLogStream = new LogStream(this, 'LogDelivery', {
      logGroup: this.stateStack.logDeliveryLogGroup,
      removalPolicy: this.config.removalPolicy,
    })

    this.deliveryStream = new CfnDeliveryStream(this, 'DeliveryStream', {
      deliveryStreamName,
      s3DestinationConfiguration: {
        roleArn: this.firehoseRole.roleArn,
        bucketArn: this.globalLogsBucket.bucketArn,
        cloudWatchLoggingOptions: {
          enabled: true,
          logGroupName: this.stateStack.logDeliveryLogGroup.logGroupName,
          logStreamName: logDeliveryLogStream.logStreamName,
        },
      },
    })

    this.firehoseRole.addToPrincipalPolicy(new PolicyStatement({
      actions: [
        'kinesis:DescribeStream',
        'kinesis:GetShardIterator',
        'kinesis:GetRecords',
        'kinesis:ListShards',
      ],
      resources: [
        this.deliveryStream.attrArn,
      ],
    }))
  }
}
