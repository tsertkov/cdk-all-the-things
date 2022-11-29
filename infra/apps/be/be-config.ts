import { Config, StageProps } from '../../lib/config.js'

export interface BeStageProps extends StageProps {
  readonly apiResourceName: string
  readonly monitorRegion: string
}

export class BeConfig extends Config {
  override get stages(): BeStageProps[] {
    return super.stages as BeStageProps[]
  }
}
