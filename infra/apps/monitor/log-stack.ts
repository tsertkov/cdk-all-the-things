import type { Construct } from 'constructs'
import { CfnDeliveryStream } from 'aws-cdk-lib/aws-kinesisfirehose'
import { PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam'
import { LogStream } from 'aws-cdk-lib/aws-logs'
import { Bucket, IBucket } from 'aws-cdk-lib/aws-s3'
import { Arn, Aws } from 'aws-cdk-lib'
import { deterministicName } from '../../lib/utils.js'
import {
  NestedStackBase,
  NestedStackBaseProps,
} from '../../lib/nested-stack-base.js'
import type { MonitorStageProps } from './monitor-config.js'
import type { StateStack } from './state-stack.js'

export interface LogStackProps extends NestedStackBaseProps {
  readonly config: MonitorStageProps
  readonly stateStack: StateStack
}

export class LogStack extends NestedStackBase {
  override readonly config: MonitorStageProps
  readonly globalLogsBucket: IBucket
  readonly stateStack: StateStack
  readonly deliveryStream: CfnDeliveryStream
  readonly firehoseRole: Role
  readonly subscriptionFilterRole: Role

  constructor(scope: Construct, id: string, props: LogStackProps) {
    super(scope, id, props)
    this.config = props.config
    this.stateStack = props.stateStack

    this.globalLogsBucket = this.initGlobalLogsBucket()
    this.firehoseRole = this.initFirehoseRole()
    this.deliveryStream = this.initDeliveryStream()
    this.subscriptionFilterRole = this.initSubscriptionFilterRole()
  }

  private initSubscriptionFilterRole() {
    const logDeliveryStreamName = deterministicName(
      {
        name: 'LogDeliveryStream',
      },
      this
    )

    const logDeliveryStreamArn = Arn.format(
      {
        service: 'firehose',
        resource: 'deliverystream',
        resourceName: logDeliveryStreamName,
      },
      this
    )

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
        resources: [logDeliveryStreamArn],
      })
    )

    return subscriptionFilterRole
  }

  private initGlobalLogsBucket() {
    const logsBucketName =
      deterministicName(
        {
          name: this.config.logsBucketName,
          region: null,
          app: null,
        },
        this
      ).toLowerCase() +
      '-' +
      Aws.ACCOUNT_ID

    return Bucket.fromBucketName(this, 'LogsBucket', logsBucketName)
  }

  private initFirehoseRole() {
    const firehoseRole = new Role(this, 'FirehoseRole', {
      assumedBy: new ServicePrincipal('firehose.amazonaws.com'),
    })

    this.stateStack.logDeliveryLogGroup.grantWrite(firehoseRole)
    this.globalLogsBucket.grantReadWrite(firehoseRole)

    return firehoseRole
  }

  private initDeliveryStream() {
    const deliveryStreamName = deterministicName(
      { name: 'LogDeliveryStream' },
      this
    )

    const logDeliveryLogStream = new LogStream(this, 'LogDelivery', {
      logGroup: this.stateStack.logDeliveryLogGroup,
      removalPolicy: this.config.removalPolicy,
    })

    const deliveryStream = new CfnDeliveryStream(this, 'DeliveryStream', {
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

    this.firehoseRole.addToPrincipalPolicy(
      new PolicyStatement({
        actions: [
          'kinesis:DescribeStream',
          'kinesis:GetShardIterator',
          'kinesis:GetRecords',
          'kinesis:ListShards',
        ],
        resources: [deliveryStream.attrArn],
      })
    )

    return deliveryStream
  }
}
