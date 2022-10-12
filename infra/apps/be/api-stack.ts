import { Construct } from 'constructs'
import { Duration } from 'aws-cdk-lib'
import { Function, Alias, Runtime, Architecture } from 'aws-cdk-lib/aws-lambda'
import { AccessLogFormat, LogGroupLogDestination, MethodLoggingLevel, EndpointType, LambdaRestApi } from 'aws-cdk-lib/aws-apigateway'
import { LogGroup } from 'aws-cdk-lib/aws-logs'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { Queue } from 'aws-cdk-lib/aws-sqs'
import { codeFromDir, deterministicName } from '../../lib/utils'
import { NestedStackBase, NestedStackBaseProps } from '../../lib/nested-stack-base'
import { ApiStateStack } from './api-state-stack'
import { EngineStateStack } from './engine-state-stack'
import { BeStageProps } from './be-config'

export interface ApiStackProps extends NestedStackBaseProps {
  readonly engineStateStack: EngineStateStack
  readonly apiStateStack: ApiStateStack
}

export class ApiStack extends NestedStackBase {
  readonly config: BeStageProps
  readonly restApiLogGroup: LogGroup
  readonly jobQueue: Queue
  readonly jobTable: Table
  apiLambda: Function
  apiLambdaAlias: Alias
  restApi: LambdaRestApi

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props)

    this.jobQueue = props.engineStateStack.jobQueue
    this.jobTable = props.apiStateStack.jobTable
    this.restApiLogGroup = props.apiStateStack.restApiLogGroup

    this.initApiLambda()
    this.initRestApi()
  }

  private initRestApi () {
    this.restApi = new LambdaRestApi(this, 'RestApi', {
      restApiName: deterministicName({ name: 'RestApi' }, this),
      handler: this.apiLambdaAlias,
      endpointTypes: [ EndpointType.REGIONAL ],
      deployOptions: {
        stageName: this.config.stageName,
        loggingLevel: MethodLoggingLevel.INFO,
        tracingEnabled: true,
        metricsEnabled: true,
        accessLogDestination: new LogGroupLogDestination(this.restApiLogGroup),
        accessLogFormat: AccessLogFormat.jsonWithStandardFields(),
      },
    })
  }

  private initApiLambda () {
    const code = codeFromDir(this.config.projectRootDir, 'go-app/bin/api')

    this.apiLambda = new Function(this, 'ApiLambda', {
      code,
      description: deterministicName({ name: 'ApiLambda' }, this),
      runtime: Runtime.GO_1_X,
      architecture: Architecture.X86_64,
      timeout: Duration.seconds(15),
      handler: 'api',
      logRetention: this.config.logRetentionDays,
      environment: {
        JOB_TABLE_NAME: this.jobTable.tableName,
        JOB_QUEUE_NAME: this.jobQueue.queueName,
        URL_PREFIX: '/' + this.config.apiResourceName,
        STAGE_NAME: this.config.stageName,
        REGION_NAME: this.region,
      },
    })

    // allow lambda to send sqs messages into job queue
    this.jobQueue.grantSendMessages(this.apiLambda)

    // allow lambda rw dynamodb
    this.jobTable.grantReadWriteData(this.apiLambda)

    this.apiLambdaAlias = new Alias(this, 'ApiLambdaAlias', {
      aliasName: 'live',
      version: this.apiLambda.currentVersion,
    })
  }
}
