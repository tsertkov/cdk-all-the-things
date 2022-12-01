#!/usr/bin/env ts-node
import 'source-map-support/register.js'
import { Infra } from '../lib/infra.js'
import apps from '../apps/index.js'

// validate input
;['INFRA_ROOT', 'INFRA_APP'].forEach((k) => {
  if (!(k in process.env)) {
    throw new Error(`Required env var '${k}' is not set`)
  }
})

// normalize input
const projectRootDir = process.env['INFRA_ROOT'] as string
const appName = process.env['INFRA_APP'] as string
const secretsDirPath = process.env['SECRETS_DIR_PATH'] || projectRootDir

if (!(appName in apps)) {
  throw new Error(`Unknown appname given: '${appName}'`)
}

// get app module
const appModule = apps[appName as keyof typeof apps]

// initialize config
const config = new appModule.configClass({
  appName,
  secretsDirPath,
  configDirPath: projectRootDir,
})

// run cdk
new Infra(config, appModule.appStackClass)
