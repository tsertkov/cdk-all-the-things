import { Config, StageProps } from '../../lib/config'

export interface FeStageProps extends StageProps {}

export class FeConfig extends Config {
  get stages (): FeStageProps[] {
    return super.stages as FeStageProps[]
  }
}
