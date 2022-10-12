import { Construct } from 'constructs'
import { Duration } from 'aws-cdk-lib'
import { Function, Alias, Runtime, Architecture } from 'aws-cdk-lib/aws-lambda'
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources'
import { Queue } from 'aws-cdk-lib/aws-sqs'
import { deterministicName, setNameTag, codeFromDir } from '../../lib/utils'
import { NestedStackBase, NestedStackBaseProps } from '../../lib/nested-stack-base'
import { EngineStateStack } from './engine-state-stack'
import { BeStageProps } from './be-config'
import { Secret } from 'aws-cdk-lib/aws-secretsmanager'

export interface EngineStackProps extends NestedStackBaseProps {
  readonly engineStateStack: EngineStateStack
}

export class EngineStack extends NestedStackBase {
  protected readonly config: BeStageProps
  readonly jobQueue: Queue
  engineLambda: Function
  engineLambdaAlias: Alias

  constructor(scope: Construct, id: string, props: EngineStackProps) {
    super(scope, id, props)

    this.jobQueue = props.engineStateStack.jobQueue
    this.initEngineLambda()
  }

  private initEngineLambda () {
    const code = codeFromDir(this.config.projectRootDir, 'go-app/bin/engine')

    // convention based secret name assembling
    const testsecretName = [
      this.config.project,
      this.config.stageName,
      this.config.appName,
      'testsecret',
    ].join('/')

    this.engineLambda = new Function(this, 'EngineLambda', {
      code,
      description: deterministicName(this, 'EngineLambda'),
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

    this.engineLambdaAlias = new Alias(this, 'EngineLambdaAlias', {
      aliasName: 'live',
      version: this.engineLambda.currentVersion,
    })

    // subscribe lambda to jobQueue
    this.engineLambdaAlias.addEventSource(
      new SqsEventSource(this.jobQueue)
    )

    // grant lambda read access to testsecret
    Secret.fromSecretNameV2(this, 'TestSecret', testsecretName)
      .grantRead(this.engineLambdaAlias)
  }
}
