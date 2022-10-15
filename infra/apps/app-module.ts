import { Config } from '../lib/config'
import { StackBase } from '../lib/stack-base'

export interface AppModule {
  Config: typeof Config
  AppStack: typeof StackBase
}
