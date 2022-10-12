import { Construct } from 'constructs'
import { NestedStackBase, NestedStackBaseProps } from '../../lib/nested-stack-base'
import { StateStack } from './state-stack'
import { CfnDeliveryStream } from 'aws-cdk-lib/aws-kinesisfirehose'
import { MonitorStageProps } from './monitor-config'
import { PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam'
import { LogStream } from 'aws-cdk-lib/aws-logs'
import { deterministicName } from '../../lib/utils'
import { Bucket, IBucket } from 'aws-cdk-lib/aws-s3'
import { Arn, Aws } from 'aws-cdk-lib'

export interface LogStackProps extends NestedStackBaseProps {
  readonly stateStack: StateStack
}

export class LogStack extends NestedStackBase {
  readonly config: MonitorStageProps
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
    const logDeliveryStreamName = deterministicName({
      name: 'LogDeliveryStream',
    }, this)

    const logDeliveryStreamArn = Arn.format({
      service: 'firehose',
      resource: 'deliverystream',
      resourceName: logDeliveryStreamName,
    }, this)

    const subscriptionFilterRole = new Role(this, 'SubscriptionFilterRole', {
      roleName: deterministicName({ name: 'SubscriptionFilterRole' }, this),
      assumedBy: new ServicePrincipal('logs.amazonaws.com'),
    })

    subscriptionFilterRole.addToPolicy(
      new PolicyStatement({
        actions: [
          'firehose:DescribeDeliveryStream',
          'firehose:PutRecord',
          'firehose:PutRecordBatch',
        ],
        resources: [
          logDeliveryStreamArn,
        ],
      }
    ))
  }

  private importGlobalLogsBucket () {
    const logsBucketName = deterministicName({
      name: this.config.logsBucketName,
      region: null,
      app: null,
    }, this) .toLowerCase() + '-' + Aws.ACCOUNT_ID

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
    const deliveryStreamName = deterministicName({ name: 'LogDeliveryStream' }, this)

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
