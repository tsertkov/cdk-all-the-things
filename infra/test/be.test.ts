import * as path from 'path'
import { Template } from 'aws-cdk-lib/assertions'
import { Infra } from '../lib/infra.js'
import type { AppStage } from '../lib/app-stage.js'
import { be } from '../apps/be/index.js'

let infra: Infra
let stage: AppStage
const APP_NAME = 'be'

beforeAll(() => {
  const config = new be.configClass({
    appName: APP_NAME,
    configDirPath: path.join(process.cwd(), '..'),
  })
  infra = new Infra(config, be.appStackClass)

  // test only first stage
  if (!infra.stages[0]) {
    throw new Error('Failed creating cdk stage')
  }

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
