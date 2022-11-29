import type { Config } from './config.js'
import type { StackBase } from './stack-base.js'

export interface AppModuleProps {
  configClass: typeof Config
  appStackClass: typeof StackBase
}

export class AppModule {
  readonly configClass: typeof Config
  readonly appStackClass: typeof StackBase

  constructor({ configClass, appStackClass }: AppModuleProps) {
    this.configClass = configClass
    this.appStackClass = appStackClass
  }
}
