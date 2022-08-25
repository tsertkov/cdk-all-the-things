import { Construct } from 'constructs'
import { Table, AttributeType } from 'aws-cdk-lib/aws-dynamodb'
import { LogGroup } from 'aws-cdk-lib/aws-logs'
import { setNameTag } from '../../lib/utils'
import { NestedStackBase, NestedStackBaseProps } from '../../lib/nested-stack-base'
import { BeStageProps } from './be-config'

export interface ApiStateStackProps extends NestedStackBaseProps {
}

export class ApiStateStack extends NestedStackBase {
  protected readonly config: BeStageProps
  jobTable: Table
  restApiLogGroup: LogGroup

  constructor(scope: Construct, id: string, props: ApiStateStackProps) {
    super(scope, id, props)

    this.initJobTable()
    this.initRestApiLogGroup()
  }

  private initRestApiLogGroup () {
    this.restApiLogGroup = new LogGroup(this, 'RestApiLogGroup', {
      retention: this.config.logRetentionDays,
      removalPolicy: this.config.removalPolicy,
    })
    setNameTag(this.restApiLogGroup, 'RestApiLogGroup')
  }

  private initJobTable () {
    this.jobTable = new Table(this, 'JobTable', {
      removalPolicy: this.config.removalPolicy,
      partitionKey: {
        name: 'client_id',
        type: AttributeType.STRING,
      },
    })

    setNameTag(this.jobTable, 'JobTable')
  }
}
