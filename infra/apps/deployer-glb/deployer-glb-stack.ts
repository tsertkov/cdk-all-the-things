import { Construct } from 'constructs'
import { Arn, ArnFormat, Aws } from 'aws-cdk-lib'
import { Pipeline } from 'aws-cdk-lib/aws-codepipeline'
import { BuildSpec, LinuxBuildImage, Project } from 'aws-cdk-lib/aws-codebuild'
import { PolicyStatement } from 'aws-cdk-lib/aws-iam'
import {
  Choice,
  Condition,
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
  CodeBuildStartBuild,
  StepFunctionsStartExecution,
} from 'aws-cdk-lib/aws-stepfunctions-tasks'
import {
  NestedStackBase,
  NestedStackBaseProps,
} from '../../lib/nested-stack-base'
import { deterministicName, regionToCode } from '../../lib/utils'
import { DeployerGlbStageProps } from './deployer-glb-config'
import { StateStack } from './state-stack'

export interface DeployerGlStackProps extends NestedStackBaseProps {
  readonly stateStack: StateStack
}

export class DeployerGlbStack extends NestedStackBase {
  readonly config: DeployerGlbStageProps
  readonly stateStack: StateStack
  readonly githubOidcProviderArn: string
  readonly codePipelines: Pipeline[] = []
  appDeployerStateMachine: StateMachine
  deployerStateMachine: StateMachine
  startBuildTask: CodeBuildStartBuild
  codeBuildRoPrj: Project
  codeBuildRwPrj: Project

  constructor(scope: Construct, id: string, props: DeployerGlStackProps) {
    super(scope, id, props)
    this.stateStack = props.stateStack

    this.initCodeBuildRoPrj()
    this.initCodeBuildRwPrj()
    this.initAppDeployerStateMachine()
    this.initDeployerStateMachine()
  }

  /**
   * Assemble deployer codebuild project environment variables for a given app
   * @param props Input props overrides
   * @returns Environment vars configuration object
   */
  private deployerEnvVars(props?: {
    app?: string
    regcode?: string
    cmd?: string
  }): {
    DEPLOYER_IMAGE: { value: string }
    STAGE: { value: string }
    VERSION: { value: string }
    CMD: { value: string }
    APP: { value: string }
    REGCODE: { value: string }
  } {
    return {
      DEPLOYER_IMAGE: {
        value: this.stateStack.deployerEcrRepo.repositoryUri,
      },
      STAGE: {
        value: this.config.stageName,
      },
      VERSION: {
        value: JsonPath.stringAt('$.version'),
      },
      CMD: {
        value: props?.cmd || JsonPath.stringAt('$.cmd'),
      },
      APP: {
        value: props?.app || JsonPath.stringAt('$.app'),
      },
      REGCODE: {
        value: props?.regcode || JsonPath.stringAt('$.regcode'),
      },
    }
  }

  private initDeployerStateMachine() {
    // make sure deployer image of given version is available
    const deployerImageAvailabilityTask = new CallAwsService(
      this,
      'DeployerImageAvailabilityTask',
      {
        service: 'ecr',
        action: 'batchGetImage',
        iamResources: [this.stateStack.deployerEcrRepo.repositoryArn],
        resultPath: JsonPath.DISCARD,
        parameters: {
          RepositoryName: this.stateStack.deployerEcrRepo.repositoryName,
          ImageIds: [
            {
              'ImageTag.$': `$.version`,
            },
          ],
        },
      }
    )

    // start deployer in codebuild with env vars mapped from task input
    const deployDeployerTask = new CodeBuildStartBuild(
      this,
      'DeployDeployerTask',
      {
        project: this.codeBuildRwPrj,
        integrationPattern: IntegrationPattern.RUN_JOB,
        resultPath: '$.deployDeployer',
        environmentVariablesOverride: this.deployerEnvVars({
          app: this.config.appName,
          cmd: 'deploy',
          // assuming single deployer region
          regcode: regionToCode(this.config.regions[0]),
        }),
      }
    )

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
    const prepareAppGroupsTask = new Pass(this, 'PrepareAppGroupsTask', {
      result: Result.fromObject({
        deploy: appGroups,
        diff: [appGroups.flat()],
      }),
      resultPath: '$.appGroups',
    })

    // start deployer in codebuild with env vars mapped from task input
    const deployAppsTask = new StepFunctionsStartExecution(
      this,
      'DeployAppsTask',
      {
        stateMachine: this.appDeployerStateMachine,
        integrationPattern: IntegrationPattern.RUN_JOB,
        resultPath: '$.deployApps',
        input: TaskInput.fromObject({
          cmd: 'deploy',
          projectType: 'rw',
          'version.$': '$.version',
          'appGroups.$': '$.appGroups.deploy',
        }),
      }
    )

    let definition: IChainable

    if (this.config.noApprovalDeploy) {
      definition = deployerImageAvailabilityTask.next(
        deployDeployerTask.next(prepareAppGroupsTask.next(deployAppsTask))
      )
    } else {
      const diffDeployerTask = new CodeBuildStartBuild(
        this,
        'DiffDeployerTask',
        {
          project: this.codeBuildRoPrj,
          integrationPattern: IntegrationPattern.RUN_JOB,
          resultPath: '$.diffDeployer',
          environmentVariablesOverride: this.deployerEnvVars({
            app: this.config.appName,
            cmd: 'diff',
            // assuming single deployer region
            regcode: regionToCode(this.config.regions[0]),
          }),
        }
      )

      const diffAppsTask = new StepFunctionsStartExecution(
        this,
        'DiffAppsTask',
        {
          stateMachine: this.appDeployerStateMachine,
          integrationPattern: IntegrationPattern.RUN_JOB,
          resultPath: '$.diffApps',
          input: TaskInput.fromObject({
            cmd: 'diff',
            projectType: 'ro',
            'version.$': '$.version',
            'appGroups.$': '$.appGroups.diff',
          }),
        }
      )

      definition = deployerImageAvailabilityTask.next(
        diffDeployerTask.next(
          deployDeployerTask.next(
            prepareAppGroupsTask.next(diffAppsTask.next(deployAppsTask))
          )
        )
      )
    }

    this.deployerStateMachine = new StateMachine(this, 'DeployerStateMachine', {
      stateMachineName: deterministicName(
        { name: 'Deployer', region: null, app: null },
        this
      ),
      definition,
    })

    this.stateStack.deployerEcrRepo.grantPull(this.deployerStateMachine)
  }

  private initAppDeployerStateMachine() {
    const paramsToPass = {
      'cmd.$': '$.cmd',
      'version.$': '$.version',
      'projectType.$': '$.projectType',
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

    // start deployer in codebuild with env vars mapped from task input
    // RO role will be used by codebuild (diff)
    const runDeployerRoTask = new CodeBuildStartBuild(
      this,
      'RunDeployerRoTask',
      {
        project: this.codeBuildRoPrj,
        integrationPattern: IntegrationPattern.RUN_JOB,
        environmentVariablesOverride: this.deployerEnvVars(),
      }
    )

    // start deployer in codebuild with env vars mapped from task input
    // RW role will be used by codebuild (deploy)
    const runDeployerRwTask = new CodeBuildStartBuild(
      this,
      'RunDeployerRwTask',
      {
        project: this.codeBuildRwPrj,
        integrationPattern: IntegrationPattern.RUN_JOB,
        environmentVariablesOverride: this.deployerEnvVars(),
      }
    )

    const decideProjectTypeTask = new Choice(this, 'DecideProjectTypeTask')
      .when(Condition.stringEquals('$.projectType', 'rw'), runDeployerRwTask)
      .when(Condition.stringEquals('$.projectType', 'ro'), runDeployerRoTask)

    const definition = appsGroupsDeployMapTask.iterator(
      appsMapTask.iterator(decideProjectTypeTask)
    )

    this.appDeployerStateMachine = new StateMachine(
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
  }

  private createCodeBuild(rw: boolean) {
    const logsDirectory = 'logs'
    const append = rw ? 'rw' : 'ro'
    const projectName = deterministicName(
      {
        region: null,
        append,
      },
      this
    )

    const projectClass = Project
    const codeBuild = new projectClass(this, `CodeBuild-${append}`, {
      projectName,
      logging: {
        cloudWatch: {
          logGroup: this.stateStack.deployerLogGroup,
        },
      },
      environment: {
        buildImage: LinuxBuildImage.AMAZON_LINUX_2_3,
        privileged: true,
        environmentVariables: {
          DEPLOYER_IMAGE: {
            value: this.stateStack.deployerEcrRepo.repositoryUri,
          },
        },
      },
      buildSpec: BuildSpec.fromObject({
        version: '0.2',
        artifacts: {
          'base-directory': logsDirectory,
          files: ['**/*'],
        },
        phases: {
          pre_build: {
            commands: [
              'CREDS=$(curl -s 169.254.170.2$AWS_CONTAINER_CREDENTIALS_RELATIVE_URI)',
              'export AWS_SESSION_TOKEN=$(echo "${CREDS}" | jq -r \'.Token\')',
              'export AWS_ACCESS_KEY_ID=$(echo "${CREDS}" | jq -r \'.AccessKeyId\')',
              'export AWS_SECRET_ACCESS_KEY=$(echo "${CREDS}" | jq -r \'.SecretAccessKey\')',
              '$(aws ecr get-login --no-include-email)',
              'export IMAGE=${DEPLOYER_IMAGE}:${VERSION:-$(cat $APP)}',
              'docker pull $IMAGE',
              `mkdir ${logsDirectory}`,
            ],
          },
          build: {
            commands: [
              [
                'docker run --rm',
                '-e AWS_SESSION_TOKEN',
                '-e AWS_ACCESS_KEY_ID',
                '-e AWS_SECRET_ACCESS_KEY',
                '-e AWS_DEFAULT_REGION',
                '-e AWS_REGION',
                '$IMAGE',
                'app="$APP" stage="$STAGE" regcode="$REGCODE" $CMD',
                `|& tee ${logsDirectory}/$CMD-$APP-$STAGE-$REGCODE.txt`,
                '&& test ${PIPESTATUS[0]} -eq 0',
              ].join(' '),
            ],
          },
        },
      }),
    })

    codeBuild.addToRolePolicy(
      new PolicyStatement({
        actions: ['ecr:GetAuthorizationToken'],
        resources: ['*'],
      })
    )

    const cdkRoleTypes = rw
      ? ['deploy', 'file-publishing', 'image-publishing', 'lookup']
      : ['lookup']

    codeBuild.addToRolePolicy(
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
    codeBuild.addToRolePolicy(
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

    if (!codeBuild.role) {
      throw Error('No role found on codeBuild project instance')
    }

    this.stateStack.deployerEcrRepo.grantPull(codeBuild.role)

    if (rw) {
      // grant role access to create and update app secrets
      codeBuild.addToRolePolicy(
        new PolicyStatement({
          actions: [
            'secretsmanager:UpdateSecret',
            'secretsmanager:CreateSecret',
          ],
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
    }

    return codeBuild
  }

  private initCodeBuildRoPrj() {
    this.codeBuildRoPrj = this.createCodeBuild(false)
  }

  private initCodeBuildRwPrj() {
    this.codeBuildRwPrj = this.createCodeBuild(true)
  }
}
