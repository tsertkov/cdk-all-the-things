import * as path from 'path'
import { Template } from 'aws-cdk-lib/assertions'
import { Infra } from '../lib/infra'
import { AppStage } from '../lib/app-stage'
import be from '../apps/be'

let infra: Infra
let stage: AppStage

beforeAll(() => {
  const config = new be.Config([ 'config.yaml' ], path.join(__dirname, '../..'), 'be')
  infra = new Infra(config, be.AppStack)

  // test only first stage
  stage = infra.stages[0]
})

describe('be', () => {
  let tpl: Template
  beforeAll(() => tpl = Template.fromStack(stage.appStack))

  test('contains expected outputs', () => {
    tpl.hasOutput('RestApiEndpoint', {})
  })

  test('contains nested stacks', () => {
    const nestedStacks = tpl.findResources('AWS::CloudFormation::Stack')
    expect(Object.keys(nestedStacks).length).toBe(5)
  })
})
