import { Config, StageProps } from '../../lib/config'

export interface MonitorStageProps extends StageProps {
  readonly logsBucketName: string
}

export class MonitorConfig extends Config {
  get stages (): MonitorStageProps[] {
    return super.stages as MonitorStageProps[]
  }
}
