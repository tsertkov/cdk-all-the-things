import { AppModule } from '../../lib/app-module.js'
import { DeployerGlbAppStack } from './deployer-glb-app-stack.js'
import { DeployerGlbConfig } from './deployer-glb-config.js'

export const deployerGlb = new AppModule({
  appStackClass: DeployerGlbAppStack,
  configClass: DeployerGlbConfig,
})
