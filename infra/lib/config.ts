import * as path from 'path'
import { deepmerge } from 'deepmerge-ts'
import { readFileSync } from 'fs'
import { RemovalPolicy } from 'aws-cdk-lib'
import { RetentionDays } from 'aws-cdk-lib/aws-logs'
import { parse } from 'yaml'

export interface StageProps {
  readonly project: string
  readonly appName: string
  readonly stageName: string
  readonly regions: string[]
  readonly tags: Record<string, string>
  readonly removalPolicy: RemovalPolicy
  readonly logRetentionDays: RetentionDays
  readonly projectRootDir: string
}

interface RawConfig {
  readonly common: Record<string, any>
  readonly stages: Record<string, any>
}

export class Config {
  private appName: string
  private projectRootDir: string
  private rawConfig: RawConfig

  constructor(configFiles: string[], projectRootDir: string, appName: string) {
    this.appName = appName
    this.projectRootDir = projectRootDir

    this.rawConfig = configFiles.reduce((a, file) => {
      const data = readFileSync(path.join(projectRootDir, file)).toString()
      const parsed = parse(data)
      return deepmerge(a, parsed)
    }, {}) as RawConfig
  }

  stageConfig (stageName: string, appName: string): StageProps {
    // merge common config with common stage config
    const config = Object.assign(
      {},
      this.rawConfig.common,
      this.rawConfig.stages[stageName],
    )

    config.stageName = stageName
    config.appName = appName
    config.projectRootDir = this.projectRootDir

    // add default tags
    config.tags = Object.assign(
      {},
      config.tags,
      {
        project: config.project,
        appname: config.appName,
        stage: stageName,
      }
    )

    // merge result config with app config and app stage config
    const appConfig = this.rawConfig[appName as keyof RawConfig]
    if (appConfig) {
      if (appConfig.common) {
        Object.assign(config, appConfig.common)
      }

      if (appConfig.stages && appConfig.stages[stageName]) {
        Object.assign(config, appConfig.stages[stageName])
      }
    }

    return config
  }

  get stages (): StageProps[] {
    return Object.keys(this.rawConfig.stages)
      .map(stageName => this.stageConfig(stageName, this.appName))
  }
}
