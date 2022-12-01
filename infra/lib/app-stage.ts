import { Stage, StageProps } from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import type { StageProps as StageConfigProps } from './config.js'
import type { StackBase } from './stack-base.js'
import { deterministicName } from './utils.js'

export interface AppStageProps {
  readonly stageProps: StageProps
  readonly config: StageConfigProps
  readonly appStackClass: typeof StackBase
}

export class AppStage extends Stage {
  appStack: StackBase

  constructor(scope: Construct, props: AppStageProps) {
    const id = stageIdFromProps(props)
    super(scope, id, props.stageProps)
    this.appStack = this.initAppStack(props)
  }

  private initAppStack(props: AppStageProps) {
    return new props.appStackClass(this, props.config.appName, {
      stackProps: {
        tags: props.config.tags,
      },
      config: props.config,
    })
  }
}

function stageIdFromProps(props: AppStageProps): string {
  const { project, stageName } = props.config
  const region = props.stageProps.env?.region

  if (region === undefined) {
    throw new Error('Region must be specified')
  }

  return deterministicName({
    project,
    stage: stageName,
    region,
  })
}
