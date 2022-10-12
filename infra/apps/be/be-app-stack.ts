import { CfnOutput } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { deterministicName } from '../../lib/utils'
import { StackBase, StackBaseProps } from '../../lib/stack-base'
import { MonitorStack } from '../../lib/monitor-stack'
import { ApiStack } from './api-stack'
import { ApiStateStack } from './api-state-stack'
import { EngineStack } from './engine-stack'
import { EngineStateStack } from './engine-state-stack'
import { BeStageProps } from './be-config'

export interface BeAppStackProps extends StackBaseProps {}

export class BeAppStack extends StackBase {
  readonly config: BeStageProps
  engineStack: EngineStack
  engineStateStack: EngineStateStack
  apiStack: ApiStack
  apiStateStack: ApiStateStack
  monitorStack: MonitorStack

  constructor(scope: Construct, id: string, props: BeAppStackProps) {
    super(scope, id, props)

    this.initNestedStacks()
    this.initOutputs()
  }

  private initNestedStacks() {
    this.engineStateStack = new EngineStateStack(this, 'EngineState', {
      config: this.config,
    })

    this.engineStack = new EngineStack(this, 'Engine', {
      config: this.config,
      engineStateStack: this.engineStateStack,
    })

    this.apiStateStack = new ApiStateStack(this, 'ApiState', {
      config: this.config,
    })

    this.apiStack = new ApiStack(this, 'Api', {
      config: this.config,
      engineStateStack: this.engineStateStack,
      apiStateStack: this.apiStateStack,
    })

    this.monitorStack = new MonitorStack(this, 'Monitor', {
      config: this.config,
      monitorRegion: this.config.monitorRegion,
      logGroupNames: [
        this.apiStack.apiLambda.logGroup.logGroupName,
        this.apiStack.restApiLogGroup.logGroupName,
        this.engineStack.engineLambda.logGroup.logGroupName,
      ],
    })
  }

  private initOutputs() {
    new CfnOutput(this, 'RestApiEndpoint', {
      value: this.apiStack.restApi.url,
      exportName: deterministicName({ name: 'RestApiEndpoint' }, this),
    })
  }
}
