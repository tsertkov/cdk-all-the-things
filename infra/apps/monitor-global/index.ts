import { AppModule } from '../app-module'
import { MonitorGlobalConfig } from './monitor-global-config'
import { MonitorGlobalAppStack } from './monitor-global-app-stack'

export default {
  Config: MonitorGlobalConfig,
  AppStack: MonitorGlobalAppStack,
} as AppModule
