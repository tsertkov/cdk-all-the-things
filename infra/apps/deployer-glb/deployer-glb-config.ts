import { Config, StageProps } from '../../lib/config.js'
import appModules from '../index.js'

export interface DeployerGlbStageProps extends StageProps {
  readonly githubRepo: string
  readonly githubOidcArnCfnOutput: string
  readonly noApprovalDeploy: boolean
  readonly nextStage?: string
  readonly prevStage?: string
  readonly ecrMaxImageCount: number
  readonly maxDeployerLambdaVersions: number
  rootConfig: Config
  appModules: string[]
  apps: [string | string[]][]
}

export class DeployerGlbConfig extends Config {
  override get stages(): DeployerGlbStageProps[] {
    return super.stages as DeployerGlbStageProps[]
  }

  override stageConfig(
    stageName: string,
    appName: string
  ): DeployerGlbStageProps {
    const stageConfig = super.stageConfig(
      stageName,
      appName
    ) as DeployerGlbStageProps

    stageConfig.rootConfig = this
    stageConfig.apps = this.rawConfig.apps
    stageConfig.appModules = Object.keys(appModules)

    return stageConfig
  }
}
