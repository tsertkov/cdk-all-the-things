import { Config, StageProps } from '../../lib/config'

export interface MonitorGlStageProps extends StageProps {
  readonly logsBucketName: string
}

export class MonitorGlConfig extends Config {
  get stages(): MonitorGlStageProps[] {
    return super.stages as MonitorGlStageProps[]
  }
}
