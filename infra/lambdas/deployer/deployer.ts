import { runMake, SpawnSyncFunction } from './lib/run-make.js'

export interface DeployerInput {
  command: string
  app: string
  regcode: string
  stage: string
}

export async function handler(event: DeployerInput, spawn?: SpawnSyncFunction) {
  validateDeployerInput(event)
  return runDeployerCommand(event, spawn)
}

function validateDeployerInput({
  command,
  app,
  regcode,
  stage,
}: DeployerInput) {
  // eslint-disable-next-line @typescript-eslint/no-extra-semi
  ;[command, app, regcode, stage].forEach((input) => {
    if (typeof input !== 'string' || input === '') {
      throw new Error('No all required input parameters were given')
    }
  })
}

async function runDeployerCommand(
  { command, app, regcode, stage }: DeployerInput,
  spawn?: SpawnSyncFunction
) {
  const status = await runMake(
    [
      command,
      `app=${app}`,
      `regcode=${regcode}`,
      `stage=${stage}`,
      'write_dir=/tmp',
    ],
    spawn
  )

  if (status !== 0) {
    throw new Error(`Deployer failed with exit code: '${status}'`)
  }
}
