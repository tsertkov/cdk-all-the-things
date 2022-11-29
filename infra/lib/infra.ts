import { App } from 'aws-cdk-lib'
import { AppStage } from './app-stage.js'
import type { Config } from './config.js'
import type { StackBase } from './stack-base.js'

export class Infra {
  readonly app: App
  readonly stages: AppStage[] = []
  protected config: Config

  constructor(config: Config, appStackClass: typeof StackBase) {
    this.app = new App()
    this.config = config
    this.initStages(appStackClass)
  }

  private initStages(appStackClass: typeof StackBase) {
    this.config.stages.forEach((stageConfig) =>
      stageConfig.regions.forEach((region) =>
        this.stages.push(
          new AppStage(this.app, {
            appStackClass,
            config: stageConfig,
            stageProps: {
              env: {
                account: stageConfig.account,
                region,
              },
            },
          })
        )
      )
    )
  }
}
