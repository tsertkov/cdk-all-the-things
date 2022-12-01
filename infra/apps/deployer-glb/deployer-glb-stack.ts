import * as path from 'node:path'
import type { Construct } from 'constructs'
import { Arn, ArnFormat, Aws, Duration } from 'aws-cdk-lib'
import { PolicyStatement } from 'aws-cdk-lib/aws-iam'
import {
  IChainable,
  IntegrationPattern,
  JsonPath,
  Map,
  Pass,
  Result,
  StateMachine,
  TaskInput,
} from 'aws-cdk-lib/aws-stepfunctions'
import {
  CallAwsService,
  StepFunctionsStartExecution,
} from 'aws-cdk-lib/aws-stepfunctions-tasks'
import {
  Code,
  DockerImageCode,
  DockerImageFunction,
  Function as Lambda,
  Runtime,
} from 'aws-cdk-lib/aws-lambda'
import {
  NestedStackBase,
  NestedStackBaseProps,
} from '../../lib/nested-stack-base.js'
import { deterministicName, regionToCode } from '../../lib/utils.js'
import type { DeployerGlbStageProps } from './deployer-glb-config.js'
import type { StateStack } from './state-stack.js'

export interface DeployerGlStackProps extends NestedStackBaseProps {
  readonly stateStack: StateStack
  readonly config: DeployerGlbStageProps
}

export class DeployerGlbStack extends NestedStackBase {
  override readonly config: DeployerGlbStageProps
  readonly stateStack: StateStack
  readonly appDeployerStateMachine: StateMachine
  readonly deployerStateMachine: StateMachine
  readonly deployerLambda: DockerImageFunction
  readonly deployerVersionPrepareLambda: Lambda

  constructor(scope: Construct, id: string, props: DeployerGlStackProps) {
    super(scope, id, props)
    this.config = props.config
    this.stateStack = props.stateStack

    this.deployerLambda = this.initDeployerLambda()
    this.deployerVersionPrepareLambda = this.initDeployerVersionPrepareLambda()
    this.appDeployerStateMachine = this.initAppDeployerStateMachine()
    this.deployerStateMachine = this.initDeployerStateMachine()
  }

  private initDeployerVersionPrepareLambda() {
    const deployerVersionPrepareLambda = new Lambda(
      this,
      'DeployerVersionPrepareLambda',
      {
        runtime: Runtime.NODEJS_18_X,
        handler: 'deployer-version-prepare.handler',
        timeout: Duration.minutes(3),
        memorySize: 128,
        environment: {
          LAMBDA_VERSIONS_TO_KEEP:
            this.config.maxDeployerLambdaVersions.toString(),
        },
        code: Code.fromAsset(
          path.join(
            this.config.projectRootDir,
            'infra/lambdas/deployer-version-prepare'
          ),
          {
            // exlude dev files from lambdas
            exclude: [
              'node_modules',
              'package-lock.json',
              '**/*.ts',
              '**/*.test.js',
              '**/*.test-setup.js',
            ],
          }
        ),
      }
    )

    // allow updating lambda config, creating, publishing and deleting function versions
    deployerVersionPrepareLambda.addToRolePolicy(
      new PolicyStatement({
        actions: [
          'lambda:GetFunction',
          'lambda:DeleteFunction',
          'lambda:ListVersionsByFunction',
          'lambda:UpdateFunctionCode',
          'lambda:PublishVersion',
        ],
        resources: [
          this.deployerLambda.functionArn,
          `${this.deployerLambda.functionArn}:*`,
        ],
      })
    )

    // allow fetching ecr image meta
    deployerVersionPrepareLambda.addToRolePolicy(
      new PolicyStatement({
        actions: ['ecr:BatchGetImage'],
        resources: [this.stateStack.deployerEcrRepo.repositoryArn],
      })
    )

    return deployerVersionPrepareLambda
  }

  private initDeployerLambda() {
    const lambda = new DockerImageFunction(this, 'DeployerLambda', {
      code: DockerImageCode.fromEcr(this.stateStack.deployerEcrRepo, {
        // tag of initial container image provisioned during bootstrap
        tagOrDigest: 'initial',
        entrypoint: ['/lambda-entrypoint.sh'],
        cmd: ['deployer.handler'],
        workingDirectory: '/var/task',
      }),
      timeout: Duration.minutes(15),
      memorySize: 1024,
    })

    const cdkRoleTypes = [
      'deploy',
      'file-publishing',
      'image-publishing',
      'lookup',
    ]

    lambda.addToRolePolicy(
      new PolicyStatement({
        actions: ['sts:AssumeRole'],
        resources: cdkRoleTypes.map((type) =>
          Arn.format(
            {
              region: '',
              service: 'iam',
              resource: 'role',
              resourceName: `cdk-hnb659fds-${type}-role-${Aws.ACCOUNT_ID}-*`,
            },
            this
          )
        ),
      })
    )

    // grant role access to secret
    lambda.addToRolePolicy(
      new PolicyStatement({
        actions: [
          'secretsmanager:GetSecretValue',
          'secretsmanager:DescribeSecret',
        ],
        resources: [
          Arn.format(
            {
              service: 'secretsmanager',
              resource: 'secret',
              arnFormat: ArnFormat.COLON_RESOURCE_NAME,
              resourceName: `${this.config.project}/${this.config.stageName}/age-key-??????`,
            },
            this
          ),
        ],
      })
    )

    // grant role access to create and update app secrets
    lambda.addToRolePolicy(
      new PolicyStatement({
        actions: ['secretsmanager:UpdateSecret', 'secretsmanager:CreateSecret'],
        resources: [
          Arn.format(
            {
              region: '*',
              service: 'secretsmanager',
              resource: 'secret',
              arnFormat: ArnFormat.COLON_RESOURCE_NAME,
              resourceName: `${this.config.project}/${this.config.stageName}/*`,
            },
            this
          ),
        ],
      })
    )

    return lambda
  }

  /**
   * Create deployer version prepare state machine definition chained with given deployDefintion
   * @param deployDefinition Deploy part of StateMachine definition
   * @returns chained definition
   */
  private createVersionPrepareDefinition(
    deployDefinition: IChainable
  ): IChainable {
    const prepareDeployerVersion = new CallAwsService(
      this,
      'PrepareDeployerVersion',
      {
        service: 'lambda',
        action: 'invoke',
        iamResources: [this.deployerVersionPrepareLambda.functionArn],
        parameters: {
          FunctionName: this.deployerVersionPrepareLambda.functionName,
          Payload: {
            'version.$': '$.version',
            deployerFunctionName: this.deployerLambda.functionName,
            deployerRepoName: this.stateStack.deployerEcrRepo.repositoryName,
            deployerRepoDomain: path.dirname(
              this.stateStack.deployerEcrRepo.repositoryUri
            ),
          },
        },
        resultPath: '$.deployerVersion',
        resultSelector: {
          'functionArn.$': 'States.StringToJson($.Payload)',
        },
      }
    )

    return prepareDeployerVersion.next(deployDefinition)
  }

  /**
   * Create deployer state machine definition
   * @returns deploy definition
   */
  private createDeployDefinition(): IChainable {
    const region = this.config.regions[0]
    if (typeof region === 'undefined') {
      throw new Error('Missing region')
    }
    const regcode = regionToCode(region)

    // invoke deployer lambda
    const deployDeployer = new CallAwsService(this, 'DeployDeployer', {
      service: 'lambda',
      action: 'invoke',
      iamResources: [this.deployerLambda.functionArn],
      resultPath: '$.deployDeployer',
      parameters: {
        'FunctionName.$': '$.deployerVersion.functionArn',
        Payload: {
          command: 'deploy',
          app: this.config.appName, // deployer app name
          stage: this.config.stageName,
          regcode,
        },
      },
    })

    const appGroups = this.config.apps.map((app) => {
      // group of apps deployed in parallel
      if (Array.isArray(app)) {
        return app
          .map((app) =>
            this.config.rootConfig
              .stageConfig(this.config.stageName, app as string)
              .regions.map((region) => ({ app, regcode: regionToCode(region) }))
          )
          .flat()
      }

      return this.config.rootConfig
        .stageConfig(this.config.stageName, app)
        .regions.map((region) => ({ app, regcode: regionToCode(region) }))
    })

    // prepare appGroups deployer and diff input
    // unfortunately passing apps input directly to deploy and diff tasks
    // is not possible due to issue in TaskInput.fromObject with
    // broken handling of nested arrays
    const prepareDeployAppsInput = new Pass(this, 'PrepareDeployAppsInput', {
      result: Result.fromObject({
        deploy: appGroups,
        diff: [appGroups.flat()],
      }),
      resultPath: '$.deployAppsInput',
    })

    // start deployer in codebuild with env vars mapped from task input
    const deployApps = new StepFunctionsStartExecution(this, 'DeployApps', {
      stateMachine: this.appDeployerStateMachine,
      integrationPattern: IntegrationPattern.RUN_JOB,
      resultPath: '$.deployApps',
      input: TaskInput.fromObject({
        cmd: 'deploy',
        'version.$': '$.version',
        'deployerVersion.$': '$.deployerVersion',
        // fixme: see comment for prepareDeployAppsInput
        // appGroups: {
        //   deploy: appGroups,
        //   diff: [appGroups.flat()],
        // },
        'appGroups.$': '$.deployAppsInput.deploy',
      }),
    })

    if (this.config.noApprovalDeploy) {
      // deploy-only state machine definition without diff and manual approval tasks
      return deployDeployer.next(prepareDeployAppsInput.next(deployApps))
    }

    // full-fledged state machine definition with diff and manual approval tasks
    const diffDeployer = new CallAwsService(this, 'DiffDeployer', {
      service: 'lambda',
      action: 'invoke',
      iamResources: [this.deployerLambda.functionArn],
      resultPath: '$.diffDeployer',
      parameters: {
        'FunctionName.$': '$.deployerVersion.functionArn',
        Payload: {
          command: 'diff',
          app: this.config.appName, // deployer app name
          stage: this.config.stageName,
          regcode,
        },
      },
    })

    const approveDeployerDiff = new Pass(this, 'ApproveDeployerDiff', {
      comment: 'Approve deployer diff',
      resultPath: JsonPath.DISCARD,
    })

    const diffApps = new StepFunctionsStartExecution(this, 'DiffApps', {
      stateMachine: this.appDeployerStateMachine,
      integrationPattern: IntegrationPattern.RUN_JOB,
      resultPath: '$.diffApps',
      input: TaskInput.fromObject({
        cmd: 'diff',
        'version.$': '$.version',
        'deployerVersion.functionArn$': '$.deployerVersion.functionArn',
        'appGroups.$': '$.deployAppsInput.diff',
      }),
    })

    const approveAppsDiffs = new Pass(this, 'ApproveAppsDiffs', {
      comment: 'Approve apps diffs',
      resultPath: JsonPath.DISCARD,
    })

    return diffDeployer.next(
      approveDeployerDiff.next(
        deployDeployer.next(
          prepareDeployAppsInput.next(
            diffApps.next(approveAppsDiffs.next(deployApps))
          )
        )
      )
    )
  }

  private initDeployerStateMachine() {
    // assemble statemachine definition
    const definition = this.createVersionPrepareDefinition(
      this.createDeployDefinition()
    )

    const deployerStateMachine = new StateMachine(
      this,
      'DeployerStateMachine',
      {
        stateMachineName: deterministicName(
          { name: 'Deployer', region: null, app: null },
          this
        ),
        definition,
      }
    )

    // allow state machine invoking deployerVersionPrepareLambda
    this.deployerVersionPrepareLambda.grantInvoke(deployerStateMachine)

    // allow state machine invoking deployerLambda versions
    deployerStateMachine.addToRolePolicy(
      new PolicyStatement({
        actions: ['lambda:InvokeFunction'],
        resources: [this.deployerLambda.functionArn + ':*'],
      })
    )

    return deployerStateMachine
  }

  private initAppDeployerStateMachine() {
    const paramsToPass = {
      'cmd.$': '$.cmd',
      'deployerVersion.$': '$.deployerVersion',
      'version.$': '$.version',
    }

    // app deployment groups are deployed in sequence
    const appsGroupsDeployMapTask = new Map(this, 'AppGroupsDeployMapTask', {
      maxConcurrency: 1,
      itemsPath: JsonPath.stringAt('$.appGroups'),
      parameters: {
        ...paramsToPass,
        'appsGroup.$': '$$.Map.Item.Value',
      },
    })

    // apps in each group are deployed in parallel
    const appsMapTask = new Map(this, 'AppsMapTask', {
      // inputPath: JsonPath.stringAt('$.appsGroup'),
      itemsPath: JsonPath.stringAt('$.appsGroup'),
      parameters: {
        ...paramsToPass,
        'app.$': '$$.Map.Item.Value.app',
        'regcode.$': '$$.Map.Item.Value.regcode',
      },
    })

    // start deployer lambda
    const runDeployer = new CallAwsService(this, 'RunDeployer', {
      service: 'lambda',
      action: 'invoke',
      iamResources: [this.deployerLambda.functionArn],
      parameters: {
        'FunctionName.$': '$.deployerVersion.functionArn',
        Payload: {
          'command.$': '$.cmd',
          'app.$': '$.app',
          'regcode.$': '$.regcode',
          stage: this.config.stageName,
        },
      },
    })

    const definition = appsGroupsDeployMapTask.iterator(
      appsMapTask.iterator(runDeployer)
    )

    const appDeployerStateMachine = new StateMachine(
      this,
      'AppDeployerStateMachine',
      {
        stateMachineName: deterministicName(
          { name: 'AppDeployer', region: null, app: null },
          this
        ),
        definition,
      }
    )

    // allow state machine invoking deployerLambda
    this.deployerLambda.grantInvoke(appDeployerStateMachine)

    return appDeployerStateMachine
  }
}
