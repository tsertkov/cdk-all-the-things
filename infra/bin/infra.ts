#!/usr/bin/env ts-node
import 'source-map-support/register'
import * as path from 'path'
import { Infra } from '../lib/infra'
import apps from '../apps'

const appName = process.env?.INFRA_APP
if (!appName || !(appName in apps)) {
  throw new Error(`Unknown appname given: '${process.env.INFRA_APP}'`)
}

const appModule = apps[appName as keyof typeof apps]
const appStackClass = appModule.AppStack
const configs = [ 'config.yaml', 'secrets.yaml' ]
const config = new appModule.Config(configs, path.join(__dirname, '../..'), appName)

new Infra(config, appStackClass)
