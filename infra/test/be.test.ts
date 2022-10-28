import * as path from 'path'
import { Template } from 'aws-cdk-lib/assertions'
import { Infra } from '../lib/infra'
import { AppStage } from '../lib/app-stage'
import be from '../apps/be'

let infra: Infra
let stage: AppStage
const APP_NAME = 'be'

beforeAll(() => {
  const { Config, AppStack } = be
  const config = new Config({
    appName: APP_NAME,
    configDirPath: path.join(__dirname, '..', '..'),
  })
  infra = new Infra(config, AppStack)

  // test only first stage
  stage = infra.stages[0]
})

describe(APP_NAME, () => {
  let tpl: Template
  beforeAll(() => (tpl = Template.fromStack(stage.appStack)))

  test('contains expected outputs', () => {
    tpl.hasOutput('RestApiEndpoint', {})
  })

  test('contains nested stacks', () => {
    const nestedStacks = tpl.findResources('AWS::CloudFormation::Stack')
    expect(Object.keys(nestedStacks).length).toBe(5)
  })
})
