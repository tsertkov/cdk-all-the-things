import { Config } from './config'
import { StackBase } from './stack-base'

export interface AppModule {
  Config: typeof Config
  AppStack: typeof StackBase
}
