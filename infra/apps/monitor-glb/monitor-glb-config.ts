import { Config, StageProps } from '../../lib/config.js'

export interface MonitorGlbStageProps extends StageProps {
  readonly logsBucketName: string
}

export class MonitorGlbConfig extends Config {
  override get stages(): MonitorGlbStageProps[] {
    return super.stages as MonitorGlbStageProps[]
  }
}
