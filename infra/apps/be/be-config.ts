import { Config, StageProps } from '../../lib/config'

export interface BeStageProps extends StageProps {
  readonly apiResourceName: string
}

export class BeConfig extends Config {
  get stages (): BeStageProps[] {
    return super.stages as BeStageProps[]
  }
}
