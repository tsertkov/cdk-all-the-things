import { Config, StageProps } from '../../lib/config'

export { StageProps as FeStageProps }

export class FeConfig extends Config {
  get stages(): StageProps[] {
    return super.stages as StageProps[]
  }
}
