import type { Construct } from 'constructs'
import { Duration } from 'aws-cdk-lib'
import {
  Alias,
  Architecture,
  Function as Lambda,
  Runtime,
} from 'aws-cdk-lib/aws-lambda'
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources'
import type { Queue } from 'aws-cdk-lib/aws-sqs'
import { Secret } from 'aws-cdk-lib/aws-secretsmanager'
import { codeFromDir, deterministicName } from '../../lib/utils.js'
import {
  NestedStackBase,
  NestedStackBaseProps,
} from '../../lib/nested-stack-base.js'
import { addLambdaMetricAlarms, LambdaMetric } from '../../lib/lambda-alarms.js'
import type { BeStageProps } from './be-config.js'
import type { EngineStateStack } from './engine-state-stack.js'

export interface EngineStackProps extends NestedStackBaseProps {
  readonly config: BeStageProps
  readonly engineStateStack: EngineStateStack
}

export class EngineStack extends NestedStackBase {
  override readonly config: BeStageProps
  readonly jobQueue: Queue
  readonly engineLambda: Lambda
  readonly engineLambdaAlias: Alias

  constructor(scope: Construct, id: string, props: EngineStackProps) {
    super(scope, id, props)

    this.config = props.config
    this.jobQueue = props.engineStateStack.jobQueue
    this.engineLambda = this.initEngineLambda()
    this.engineLambdaAlias = this.initEngineLambdaAlias()
  }

  private initEngineLambdaAlias() {
    const engineLambdaAlias = new Alias(this, 'EngineLambdaAlias', {
      aliasName: 'live',
      version: this.engineLambda.currentVersion,
    })

    // subscribe lambda to jobQueue
    engineLambdaAlias.addEventSource(new SqsEventSource(this.jobQueue))
    return engineLambdaAlias
  }

  private initEngineLambda() {
    const code = codeFromDir(this.config.projectRootDir, 'go-app/bin/engine')

    // convention based secret name assembling
    const testsecretName = deterministicName(
      {
        name: 'testsecret',
        region: null,
        separator: '/',
      },
      this
    )

    const engineLambda = new Lambda(this, 'EngineLambda', {
      code,
      description: deterministicName({ name: 'EngineLambda ' }, this),
      runtime: Runtime.GO_1_X,
      architecture: Architecture.X86_64,
      timeout: Duration.seconds(15),
      handler: 'engine',
      logRetention: this.config.logRetentionDays,
      environment: {
        STAGE_NAME: this.config.stageName,
        REGION_NAME: this.region,
        TESTSECRET_NAME: testsecretName,
      },
    })

    // grant lambda read access to testsecret
    Secret.fromSecretNameV2(this, 'TestSecret', testsecretName).grantRead(
      engineLambda
    )

    addLambdaMetricAlarms({
      stack: this,
      id: 'EngineLambda',
      lambda: engineLambda,
      metricAlarms: [
        { metric: LambdaMetric.ERRORS },
        { metric: LambdaMetric.DURATION },
      ],
    })

    return engineLambda
  }
}
