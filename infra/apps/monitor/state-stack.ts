import type { Construct } from 'constructs'
import { LogGroup } from 'aws-cdk-lib/aws-logs'
import { CfnGroup } from 'aws-cdk-lib/aws-resourcegroups'
import {
  NestedStackBase,
  NestedStackBaseProps,
} from '../../lib/nested-stack-base.js'
import type { MonitorStageProps } from './monitor-config.js'

interface StateStackProps extends NestedStackBaseProps {
  readonly config: MonitorStageProps
}

export class StateStack extends NestedStackBase {
  override readonly config: MonitorStageProps
  readonly logDeliveryLogGroup: LogGroup
  readonly resourceGroup: CfnGroup

  constructor(scope: Construct, id: string, props: StateStackProps) {
    super(scope, id, props)
    this.config = props.config
    this.resourceGroup = this.initResourceGroup()
    this.logDeliveryLogGroup = this.initLogDeliveryLogGroup()
  }

  private initResourceGroup() {
    return new CfnGroup(this, 'ResourceGroup', {
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
    return new LogGroup(this, 'LogDelivery', {
      retention: this.config.logRetentionDays,
      removalPolicy: this.config.removalPolicy,
    })
  }
}
