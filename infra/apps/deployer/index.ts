import { AppModule } from '../app-module'
import { DeployerAppStack } from './deployer-app-stack'
import { DeployerConfig } from './deployer-config'

export default {
  AppStack: DeployerAppStack,
  Config: DeployerConfig,
} as AppModule
