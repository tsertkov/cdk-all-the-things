import type { Construct } from 'constructs'
import { Aws } from 'aws-cdk-lib'
import { CfnSubscriptionFilter } from 'aws-cdk-lib/aws-logs'
import { NestedStackBase, NestedStackBaseProps } from './nested-stack-base.js'
import { regionToCode } from './utils.js'

interface MonitorStackProps extends NestedStackBaseProps {
  logGroupNames: string[]
  monitorRegion: string
}

export class MonitorStack extends NestedStackBase {
  constructor(scope: Construct, id: string, props: MonitorStackProps) {
    super(scope, id, props)
    this.initLogSubscriptions(props.logGroupNames)
  }

  private initLogSubscriptions(logGroupNames: string[]) {
    const regCode = regionToCode(this.region)

    const logDeliveryStreamName = `${this.config.project}-${this.config.stageName}-${regCode}-monitor-LogDeliveryStream`
    const logDeliveryStreamArn =
      `arn:${this.partition}:firehose:` +
      `${this.region}:${Aws.ACCOUNT_ID}:deliverystream/` +
      logDeliveryStreamName

    const subscriptionFilterRoleName = `${this.config.project}-${this.config.stageName}-${regCode}-monitor-SubscriptionFilterRole`
    const subscriptionFilterRoleArn = `arn:${this.partition}:iam::${Aws.ACCOUNT_ID}:role/${subscriptionFilterRoleName}`

    logGroupNames.forEach(
      (logGroupName, i) =>
        new CfnSubscriptionFilter(this, `SubscriptionFilter${i}`, {
          destinationArn: logDeliveryStreamArn,
          roleArn: subscriptionFilterRoleArn,
          filterPattern: '',
          logGroupName,
        })
    )
  }
}
