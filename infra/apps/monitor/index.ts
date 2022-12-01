import { AppModule } from '../../lib/app-module.js'
import { MonitorConfig } from './monitor-config.js'
import { MonitorAppStack } from './monitor-app-stack.js'

export const monitor = new AppModule({
  appStackClass: MonitorAppStack,
  configClass: MonitorConfig,
})
