import { Config, StageProps } from '../../lib/config'
import appModules from '..'

export interface DeployerStageProps extends StageProps {
  readonly githubRepo: string
  rootConfig: Config
  appModules: string[]
}

export class DeployerConfig extends Config {
  get stages (): DeployerStageProps[] {
    return super.stages as DeployerStageProps[]
  }

  stageConfig (stageName: string, appName: string): DeployerStageProps {
    const stageConfig = super.stageConfig(stageName, appName) as DeployerStageProps
    stageConfig.rootConfig = this
    stageConfig.appModules = Object.keys(appModules)
    return stageConfig
  }
}
