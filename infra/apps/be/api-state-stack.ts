import type { Construct } from 'constructs'
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb'
import { LogGroup } from 'aws-cdk-lib/aws-logs'
import {
  NestedStackBase,
  NestedStackBaseProps,
} from '../../lib/nested-stack-base.js'
import type { BeStageProps } from './be-config.js'

export interface ApiStateStackProps extends NestedStackBaseProps {
  readonly config: BeStageProps
}

export class ApiStateStack extends NestedStackBase {
  override readonly config: BeStageProps
  readonly jobTable: Table
  readonly restApiLogGroup: LogGroup

  constructor(scope: Construct, id: string, props: ApiStateStackProps) {
    super(scope, id, props)

    this.config = props.config
    this.jobTable = this.initJobTable()
    this.restApiLogGroup = this.initRestApiLogGroup()
  }

  private initRestApiLogGroup() {
    return new LogGroup(this, 'RestApiLogGroup', {
      retention: this.config.logRetentionDays,
      removalPolicy: this.config.removalPolicy,
    })
  }

  private initJobTable() {
    return new Table(this, 'JobTable', {
      removalPolicy: this.config.removalPolicy,
      partitionKey: {
        name: 'client_id',
        type: AttributeType.STRING,
      },
    })
  }
}
