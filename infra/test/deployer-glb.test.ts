import * as path from 'path'
import { Template } from 'aws-cdk-lib/assertions'
import { AppStage } from '../lib/app-stage'
import { Infra } from '../lib/infra'
import deployerGlb from '../apps/deployer-glb'

let infra: Infra
let stage: AppStage
const APP_NAME = 'deployer-glb'

beforeAll(() => {
  const config = new deployerGlb.Config(
    ['config.yaml'],
    path.join(__dirname, '../..'),
    APP_NAME
  )
  infra = new Infra(config, deployerGlb.AppStack)

  // test only first stage
  stage = infra.stages[0]
})

describe(APP_NAME, () => {
  let tpl: Template
  beforeAll(() => (tpl = Template.fromStack(stage.appStack)))

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
