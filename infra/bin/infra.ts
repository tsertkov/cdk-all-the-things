#!/usr/bin/env ts-node
import 'source-map-support/register'
import * as path from 'path'
import { Infra } from '../lib/infra'
import apps from '../apps'

const projectRootDir = path.join(__dirname, '..', '..')
const appName = process.env?.INFRA_APP

if (!appName || !(appName in apps)) {
  throw new Error(`Unknown appname given: '${process.env.INFRA_APP}'`)
}

const appModule = apps[appName as keyof typeof apps]
const { AppStack, Config } = appModule

const config = new Config({
  appName,
  configDirPath: projectRootDir,
})

new Infra(config, AppStack)
