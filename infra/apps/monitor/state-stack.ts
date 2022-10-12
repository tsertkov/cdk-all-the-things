import { Construct } from 'constructs'
import { NestedStackBase, NestedStackBaseProps } from '../../lib/nested-stack-base'
import { LogGroup } from 'aws-cdk-lib/aws-logs'
import { CfnGroup } from 'aws-cdk-lib/aws-resourcegroups'
import { MonitorStageProps } from './monitor-config'

export interface StateStackProps extends NestedStackBaseProps {
}

export class StateStack extends NestedStackBase {
  readonly config: MonitorStageProps
  logDeliveryLogGroup: LogGroup
  resourceGroup: CfnGroup

  constructor(scope: Construct, id: string, props: StateStackProps) {
    super(scope, id, props)
    this.initResourceGroup()
    this.initLogDeliveryLogGroup()
  }

  private initResourceGroup () {
    this.resourceGroup = new CfnGroup(this, 'ResourceGroup', {
      name: `${this.config.project}-${this.config.stageName}`,
      resourceQuery: {
        type: 'TAG_FILTERS_1_0',
        query: {
          tagFilters: [{
            key: 'project',
            values: [ this.config.project ],
          }],
        },
      },
    })
  }

  private initLogDeliveryLogGroup () {
    this.logDeliveryLogGroup = new LogGroup(this, 'LogDelivery', {
      retention: this.config.logRetentionDays,
      removalPolicy: this.config.removalPolicy,
    })
  }
}
