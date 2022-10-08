import { Config, StageProps } from '../../lib/config'

export interface MonitorGlobalStageProps extends StageProps {
  readonly logsBucketName: string
}

export class MonitorGlobalConfig extends Config {
  get stages (): MonitorGlobalStageProps[] {
    return super.stages as MonitorGlobalStageProps[]
  }
}
