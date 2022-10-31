import { readdirSync, readFileSync } from 'fs'
import * as path from 'path'
import { deepmerge } from 'deepmerge-ts'
import { RemovalPolicy } from 'aws-cdk-lib'
import { RetentionDays } from 'aws-cdk-lib/aws-logs'
import { parse as parseYaml } from 'yaml'

export interface StageProps {
  readonly account?: string
  readonly project: string
  readonly appName: string
  readonly stageName: string
  readonly regions: string[]
  readonly tags: Record<string, string>
  readonly removalPolicy: RemovalPolicy
  readonly logRetentionDays: RetentionDays
  readonly projectRootDir: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MapOfAny = Record<string, any>

export interface RawConfig {
  readonly common?: MapOfAny
  readonly stages: MapOfAny
  readonly project: string
}

export interface ConfigProps {
  appName: string
  configDirPath: string
  configFileName?: string
  secretsDirName?: string
  secretsFileRegExp?: RegExp
}

const DEFAULT_CONFIG_PROPS = {
  configFileName: 'config.yaml',
  secretsDirName: 'secrets',
  secretsFileRegExp: /^config-([^.]+)\.yaml$/,
}

export class Config {
  private appName: string
  private projectRootDir: string
  protected rawConfig: RawConfig

  constructor(props: ConfigProps) {
    const {
      appName,
      configDirPath,
      configFileName,
      secretsDirName,
      secretsFileRegExp,
    } = Object.assign({}, DEFAULT_CONFIG_PROPS, props)

    this.appName = appName
    this.projectRootDir = configDirPath

    this.rawConfig = this.readConfigs(
      configDirPath,
      configFileName,
      secretsDirName,
      secretsFileRegExp
    )
  }

  private readConfigs(
    configDirPath: string,
    configFileName: string,
    secretsDirName: string,
    secretsFileRegExp: RegExp
  ) {
    const configs = [
      this.readConfigFile(path.join(configDirPath, configFileName)),
    ]

    const secretsDirPath = path.join(configDirPath, secretsDirName)
    readdirSync(secretsDirPath).forEach((file) => {
      const m = file.match(secretsFileRegExp)
      if (!m) return

      const config = this.readConfigFile(path.join(secretsDirPath, file))
      if (config === null) return

      configs.push(this.readConfigFile(path.join(secretsDirPath, file)))
    })

    return deepmerge(...configs) as RawConfig
  }

  private readConfigFile(file: string) {
    const data = readFileSync(file).toString()
    const config = parseYaml(data)

    if (typeof config !== 'object') {
      throw new Error(
        `Invalid config file (it does not parse to object): ${file}`
      )
    }

    return config
  }

  stageConfig(stageName: string, appName: string): StageProps {
    const tags = {
      project: this.rawConfig.project,
      appname: appName,
      stage: stageName,
    }

    const appConfig = this.rawConfig[appName as keyof RawConfig] as MapOfAny

    // merge common config with common stage config
    // with app common config with app stage config
    return Object.assign(
      {},
      this.rawConfig.common,
      this.rawConfig.stages[stageName],
      appConfig.common || {},
      appConfig.stages && appConfig.stages[stageName]
        ? appConfig.stages[stageName]
        : {},
      {
        project: this.rawConfig.project,
        projectRootDir: this.projectRootDir,
        tags,
        stageName,
        appName,
      }
    )
  }

  get stages(): StageProps[] {
    return Object.keys(this.rawConfig.stages).map((stageName) =>
      this.stageConfig(stageName, this.appName)
    )
  }
}
