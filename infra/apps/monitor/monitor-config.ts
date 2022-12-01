import { Config, StageProps } from '../../lib/config.js'

export interface MonitorStageProps extends StageProps {
  readonly logsBucketName: string
  readonly globalRegion: string
}

export class MonitorConfig extends Config {
  override get stages(): MonitorStageProps[] {
    return super.stages as MonitorStageProps[]
  }
}
