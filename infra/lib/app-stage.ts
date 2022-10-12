import { Construct } from 'constructs'
import { Stage, StageProps } from 'aws-cdk-lib'
import { StageProps as StageConfigProps } from './config'
import { deterministicName } from './utils'
import { StackBase } from './stack-base'

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
    this.initAppStack(props)
  }

  private initAppStack(props: AppStageProps) {
    this.appStack = new props.appStackClass(this, props.config.appName, {
      stackProps: {
        tags: props.config.tags,
      },
      config: props.config,
    })
  }
}

function stageIdFromProps (props: AppStageProps): string {
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
