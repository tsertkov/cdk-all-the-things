import * as path from 'path'
import { Template } from 'aws-cdk-lib/assertions'
import { AppStage } from '../lib/app-stage'
import { Infra } from '../lib/infra'
import monitor from '../apps/monitor'

let infra: Infra
let stage: AppStage

beforeAll(() => {
  const config = new monitor.Config([ 'config.yaml' ], path.join(__dirname, '../..'), 'monitor')
  infra = new Infra(config, monitor.AppStack)

  // test only first stage
  stage = infra.stages[0]
})

describe('monitor', () => {
  let tpl: Template
  beforeAll(() => tpl = Template.fromStack(stage.appStack))

  test('contains expected outputs', () => {
    tpl.hasOutput('LogDeliveryStreamArn', {})
  })

  test('contains nested stacks', () => {
    const nestedStacks = tpl.findResources('AWS::CloudFormation::Stack')
    expect(Object.keys(nestedStacks).length).toBe(2)
  })
})
