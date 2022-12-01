import { AppModule } from '../../lib/app-module.js'
import { BeAppStack } from './be-app-stack.js'
import { BeConfig } from './be-config.js'

export const be = new AppModule({
  appStackClass: BeAppStack,
  configClass: BeConfig,
})
