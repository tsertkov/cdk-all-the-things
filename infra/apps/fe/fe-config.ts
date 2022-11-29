import { Config, StageProps } from '../../lib/config.js'

export { StageProps as FeStageProps }

export class FeConfig extends Config {
  override get stages(): StageProps[] {
    return super.stages as StageProps[]
  }
}
