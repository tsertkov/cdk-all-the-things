import * as path from 'path'
import { Template } from 'aws-cdk-lib/assertions'
import { AppStage } from '../lib/app-stage'
import { Infra } from '../lib/infra'
import deployerGlb from '../apps/deployer-glb'

let infra: Infra
let stage: AppStage
const APP_NAME = 'deployer-glb'

beforeAll(() => {
  const { Config, AppStack } = deployerGlb
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
    tpl.hasOutput('CiRoleArn', {})
    tpl.hasOutput('DeployerEcrRepoUri', {})
    tpl.hasOutput('ArtifactsBucketName', {})
  })

  test('contains nested stacks', () => {
    const nestedStacks = tpl.findResources('AWS::CloudFormation::Stack')
    expect(Object.keys(nestedStacks).length).toBe(2)
  })
})
