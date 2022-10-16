import { AppModule } from '../../lib/app-module'
import { MonitorConfig } from './monitor-config'
import { MonitorAppStack } from './monitor-app-stack'

export default {
  Config: MonitorConfig,
  AppStack: MonitorAppStack,
} as AppModule
