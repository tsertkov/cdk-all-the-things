import { Config, StageProps } from '../../lib/config'
import appModules from '..'

export interface DeployerGlbStageProps extends StageProps {
  readonly githubRepo: string
  readonly githubOidcArnCfnOutput: string
  readonly noApprovalDeploy: boolean
  readonly nextStage?: string
  readonly ecrMaxImageCount: number
  nextStageConfig?: DeployerGlbStageProps
  rootConfig: Config
  appModules: string[]
}

export class DeployerGlbConfig extends Config {
  get stages(): DeployerGlbStageProps[] {
    return super.stages as DeployerGlbStageProps[]
  }

  stageConfig(stageName: string, appName: string): DeployerGlbStageProps {
    const stageConfig = super.stageConfig(
      stageName,
      appName
    ) as DeployerGlbStageProps

    stageConfig.rootConfig = this
    stageConfig.appModules = Object.keys(appModules)

    if (stageConfig.nextStage) {
      stageConfig.nextStageConfig = this.stageConfig(
        stageConfig.nextStage,
        appName
      )
    }

    return stageConfig
  }
}
