import { AppModule } from '../../lib/app-module.js'
import { FeConfig } from './fe-config.js'
import { FeAppStack } from './fe-app-stack.js'

export const fe = new AppModule({
  appStackClass: FeAppStack,
  configClass: FeConfig,
})
