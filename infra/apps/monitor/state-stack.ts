import { Construct } from 'constructs'
import { LogGroup } from 'aws-cdk-lib/aws-logs'
import { CfnGroup } from 'aws-cdk-lib/aws-resourcegroups'
import {
  NestedStackBase,
  NestedStackBaseProps,
} from '../../lib/nested-stack-base'
import { MonitorStageProps } from './monitor-config'

export class StateStack extends NestedStackBase {
  readonly config: MonitorStageProps
  logDeliveryLogGroup: LogGroup
  resourceGroup: CfnGroup

  constructor(scope: Construct, id: string, props: NestedStackBaseProps) {
    super(scope, id, props)
    this.initResourceGroup()
    this.initLogDeliveryLogGroup()
  }

  private initResourceGroup() {
    this.resourceGroup = new CfnGroup(this, 'ResourceGroup', {
      name: `${this.config.project}-${this.config.stageName}`,
      resourceQuery: {
        type: 'TAG_FILTERS_1_0',
        query: {
          tagFilters: [
            {
              key: 'project',
              values: [this.config.project],
            },
          ],
        },
      },
    })
  }

  private initLogDeliveryLogGroup() {
    this.logDeliveryLogGroup = new LogGroup(this, 'LogDelivery', {
      retention: this.config.logRetentionDays,
      removalPolicy: this.config.removalPolicy,
    })
  }
}
