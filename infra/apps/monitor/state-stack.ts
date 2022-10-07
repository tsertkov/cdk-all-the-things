import { Construct } from 'constructs'
import { Bucket } from 'aws-cdk-lib/aws-s3'
import { NestedStackBase, NestedStackBaseProps } from '../../lib/nested-stack-base'
import { LogGroup } from 'aws-cdk-lib/aws-logs'
import { CfnGroup } from 'aws-cdk-lib/aws-resourcegroups'

export interface StateStackProps extends NestedStackBaseProps {
}

export class StateStack extends NestedStackBase {
  logsBucket: Bucket
  logDeliveryLogGroup: LogGroup
  resourceGroup: CfnGroup

  constructor(scope: Construct, id: string, props: StateStackProps) {
    super(scope, id, props)
    this.initResourceGroup()
    this.initLogsBucket()
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

  private initLogsBucket () {
    this.logsBucket = new Bucket(this, 'LogsBucket', {
      removalPolicy: this.config.removalPolicy,
    })
  }

  private initLogDeliveryLogGroup () {
    this.logDeliveryLogGroup = new LogGroup(this, 'LogDelivery', {
      retention: this.config.logRetentionDays,
      removalPolicy: this.config.removalPolicy,
    })
  }
}
