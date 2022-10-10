import * as path from 'path'
import { Template } from 'aws-cdk-lib/assertions'
import { AppStage } from '../lib/app-stage'
import { Infra } from '../lib/infra'
import deployerGl from '../apps/deployer-gl'

let infra: Infra
let stage: AppStage

beforeAll(() => {
  const config = new deployerGl.Config([ 'config.yaml' ], path.join(__dirname, '../..'), 'deployer-gl')
  infra = new Infra(config, deployerGl.AppStack)

  // test only first stage
  stage = infra.stages[0]
})

describe('deployer-gl', () => {
  let tpl: Template
  beforeAll(() => tpl = Template.fromStack(stage.appStack))

  test('contains expected outputs', () => {
    tpl.hasOutput('CiRoleName', {})
    tpl.hasOutput('DeployerEcrRepoUri', {})
    tpl.hasOutput('ArtifactsBucketName', {})
  })

  test('contains nested stacks', () => {
    const nestedStacks = tpl.findResources('AWS::CloudFormation::Stack')
    expect(Object.keys(nestedStacks).length).toBe(2)
  })
})
