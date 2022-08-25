import { Construct } from 'constructs'
import { NestedStackBase, NestedStackBaseProps } from '../../lib/nested-stack-base'
import { StateStack } from './state-stack'
import { CfnDeliveryStream } from 'aws-cdk-lib/aws-kinesisfirehose'
import { MonitorStageProps } from './monitor-config'
import { PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam'
import { LogStream } from 'aws-cdk-lib/aws-logs'

export interface LogStackProps extends NestedStackBaseProps {
  readonly stateStack: StateStack
}

export class LogStack extends NestedStackBase {
  protected readonly config: MonitorStageProps
  stateStack: StateStack
  deliveryStream: CfnDeliveryStream
  firehoseRole: Role
  deliveryBackupLogStream: LogStream
  deliveryLogStream: LogStream

  constructor(scope: Construct, id: string, props: LogStackProps) {
    super(scope, id, props)
    this.stateStack = props.stateStack

    this.initFirehoseRole()
    this.initDeliveryStream()
  }

  private initFirehoseRole () {
    this.firehoseRole = new Role(this, 'FirehoseRole', {
      assumedBy: new ServicePrincipal('firehose.amazonaws.com'),
    })

    this.stateStack.logDeliveryBackupBucket.grantReadWrite(this.firehoseRole)
    this.stateStack.logDeliveryLogGroup.grantWrite(this.firehoseRole)
  }

  private initDeliveryStream () {
    const deliveryStreamName = [
      this.config.project,
      this.config.appName,
      'LogDeliveryStream',
    ].join('-')

    const logDeliveryBackupLogStream = new LogStream(this, 'LogDeliveryBackup', {
      logGroup: this.stateStack.logDeliveryLogGroup,
      removalPolicy: this.config.removalPolicy,
    })

    const logDeliveryLogStream = new LogStream(this, 'LogDelivery', {
      logGroup: this.stateStack.logDeliveryLogGroup,
      removalPolicy: this.config.removalPolicy,
    })

    this.deliveryStream = new CfnDeliveryStream(this, 'DeliveryStream', {
      deliveryStreamName,
      deliveryStreamType: 'DirectPut',
      httpEndpointDestinationConfiguration: {
        roleArn: this.firehoseRole.roleArn,
        endpointConfiguration: {
          url: this.config.hecEndpoint,
          accessKey: this.config.hecToken,
        },
        cloudWatchLoggingOptions: {
          enabled: true,
          logGroupName: this.stateStack.logDeliveryLogGroup.logGroupName,
          logStreamName: logDeliveryLogStream.logStreamName,
        },
        s3BackupMode: 'FailedDataOnly',
        s3Configuration: {
          bucketArn: this.stateStack.logDeliveryBackupBucket.bucketArn,
          roleArn: this.firehoseRole.roleArn,
          cloudWatchLoggingOptions: {
            enabled: true,
            logGroupName: this.stateStack.logDeliveryLogGroup.logGroupName,
            logStreamName: logDeliveryBackupLogStream.logStreamName,
          },
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
