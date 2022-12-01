import { AppModule } from '../../lib/app-module.js'
import { MonitorGlbConfig } from './monitor-glb-config.js'
import { MonitorGlbAppStack } from './monitor-glb-app-stack.js'

export const monitorGlb = new AppModule({
  appStackClass: MonitorGlbAppStack,
  configClass: MonitorGlbConfig,
})
