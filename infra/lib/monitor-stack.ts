import { Construct } from 'constructs'
import { Aws } from 'aws-cdk-lib'
import { CfnSubscriptionFilter } from 'aws-cdk-lib/aws-logs'
import { PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam'
import { NestedStackBase, NestedStackBaseProps } from './nested-stack-base'

interface MonitorStackProps extends NestedStackBaseProps {
  logGroupNames: Record<string, string>
  monitorRegion: string
}

export class MonitorStack extends NestedStackBase {
  readonly logDeliveryStreamArn: string
  readonly logGroupNames: Record<string, string>

  constructor(scope: Construct, id: string, props: MonitorStackProps) {
    super(scope, id, props)
    this.logGroupNames = props.logGroupNames
    this.logDeliveryStreamArn = `arn:${this.partition}:firehose:`
      + `${props.monitorRegion}:${Aws.ACCOUNT_ID}:deliverystream/`
      + `${this.config.project}-${this.config.stageName}-monitor-LogDeliveryStream`
    this.initLogSubscriptions()
  }

  private initLogSubscriptions () {
    const subscriptionFilterRole = new Role(this, 'SubscriptionFilterRole', {
      assumedBy: new ServicePrincipal('logs.amazonaws.com'),
    })

    subscriptionFilterRole.addToPolicy(
      new PolicyStatement({
        actions: [
          'firehose:DescribeDeliveryStream',
          'firehose:PutRecord',
          'firehose:PutRecordBatch',
        ],
        resources: [ this.logDeliveryStreamArn ],
      }
    ))

    for (const [name, logGroupName] of Object.entries(this.logGroupNames)) {
      new CfnSubscriptionFilter(this, `SubscriptionFilter${name}`, {
        destinationArn: this.logDeliveryStreamArn,
        roleArn: subscriptionFilterRole.roleArn,
        filterPattern: '',
        logGroupName,
      })
    }
  }
}
