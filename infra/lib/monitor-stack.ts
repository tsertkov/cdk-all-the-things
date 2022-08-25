import { Construct } from 'constructs'
import { Fn } from 'aws-cdk-lib'
import { CfnSubscriptionFilter } from 'aws-cdk-lib/aws-logs'
import { PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam'
import { NestedStackBase, NestedStackBaseProps } from './nested-stack-base'

interface MonitorStackProps extends NestedStackBaseProps {
  logGroupNames: Record<string, string>
}

export class MonitorStack extends NestedStackBase {
  readonly logDeliveryStreamArn: string
  readonly logGroupNames: Record<string, string>

  constructor(scope: Construct, id: string, props: MonitorStackProps) {
    super(scope, id, props)
    this.logGroupNames = props.logGroupNames
    this.logDeliveryStreamArn = Fn.importValue([ this.config.project, 'monitor', 'LogDeliveryStreamArn', ].join('-'))
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
