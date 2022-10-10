import { Config, StageProps } from '../../lib/config'
import appModules from '..'

export interface DeployerGlStageProps extends StageProps {
  readonly githubRepo: string
  readonly githubOidcArnCfnOutput: string
  readonly noApprovalDeploy: boolean
  readonly promotionSrc: string
  rootConfig: Config
  appModules: string[]
}

export class DeployerGlConfig extends Config {
  get stages (): DeployerGlStageProps[] {
    return super.stages as DeployerGlStageProps[]
  }

  stageConfig (stageName: string, appName: string): DeployerGlStageProps {
    const stageConfig = super.stageConfig(stageName, appName) as DeployerGlStageProps
    stageConfig.rootConfig = this
    stageConfig.appModules = Object.keys(appModules)
    return stageConfig
  }
}
