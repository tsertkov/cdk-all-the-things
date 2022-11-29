import { CfnOutput } from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import { MonitorStack } from '../../lib/monitor-stack.js'
import { StackBase, StackBaseProps } from '../../lib/stack-base.js'
import { deterministicName } from '../../lib/utils.js'
import { ApiStack } from './api-stack.js'
import { ApiStateStack } from './api-state-stack.js'
import { EngineStack } from './engine-stack.js'
import { EngineStateStack } from './engine-state-stack.js'
import type { BeStageProps } from './be-config.js'

export interface BeAppStackProps extends StackBaseProps {
  readonly config: BeStageProps
}

export class BeAppStack extends StackBase {
  override readonly config: BeStageProps
  readonly engineStack: EngineStack
  readonly engineStateStack: EngineStateStack
  readonly apiStack: ApiStack
  readonly apiStateStack: ApiStateStack
  readonly monitorStack: MonitorStack

  constructor(scope: Construct, id: string, props: BeAppStackProps) {
    super(scope, id, props)
    this.config = props.config

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

    this.initOutputs()
  }

  private initOutputs() {
    new CfnOutput(this, 'RestApiEndpoint', {
      value: this.apiStack.restApi.url,
      exportName: deterministicName({ name: 'RestApiEndpoint' }, this),
    })
  }
}
