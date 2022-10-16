import { Config, StageProps } from '../../lib/config'

export interface MonitorGlbStageProps extends StageProps {
  readonly logsBucketName: string
}

export class MonitorGlbConfig extends Config {
  get stages(): MonitorGlbStageProps[] {
    return super.stages as MonitorGlbStageProps[]
  }
}
