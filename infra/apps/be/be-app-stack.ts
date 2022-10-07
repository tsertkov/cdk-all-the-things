import { CfnOutput } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { deterministicName, setNameTag } from '../../lib/utils'
import { StackBase, StackBaseProps } from '../../lib/stack-base'
import { MonitorStack } from '../../lib/monitor-stack'
import { ApiStack } from './api-stack'
import { ApiStateStack } from './api-state-stack'
import { EngineStack } from './engine-stack'
import { EngineStateStack } from './engine-state-stack'
import { BeStageProps } from './be-config'

export interface BeAppStackProps extends StackBaseProps {}

export class BeAppStack extends StackBase {
  protected readonly config: BeStageProps
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

    setNameTag(this.engineStateStack, 'EngineStateStack')

    this.engineStack = new EngineStack(this, 'Engine', {
      config: this.config,
      engineStateStack: this.engineStateStack,
    })

    setNameTag(this.engineStack, 'EngineStack')

    this.apiStateStack = new ApiStateStack(this, 'ApiState', {
      config: this.config,
    })

    setNameTag(this.apiStateStack, 'ApiStateStack')

    this.apiStack = new ApiStack(this, 'Api', {
      config: this.config,
      engineStateStack: this.engineStateStack,
      apiStateStack: this.apiStateStack,
    })

    setNameTag(this.apiStack, 'ApiStack')

    this.monitorStack = new MonitorStack(this, 'Monitor', {
      config: this.config,
      monitorRegion: this.config.monitorRegion,
      logGroupNames: {
        'ApiLambda': this.apiStack.apiLambda.logGroup.logGroupName,
        'RestApi': this.apiStack.restApiLogGroup.logGroupName,
        'EngineLambda': this.engineStack.engineLambda.logGroup.logGroupName,
      },
    })

    this.monitorStack.addDependency(this.apiStack)
    this.monitorStack.addDependency(this.engineStack)

    setNameTag(this.monitorStack, 'MonitorStack')
  }

  private initOutputs() {
    new CfnOutput(this, 'RestApiEndpoint', {
      value: this.apiStack.restApi.url,
      exportName: deterministicName(this, 'RestApiEndpoint'),
    })
  }
}
