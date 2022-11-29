import { spawnSync } from 'child_process'

interface DeployerInput {
  command: string
  app: string
  regcode: string
  stage: string
}

export async function handler(event: DeployerInput) {
  validateDeployerInput(event)
  await runDeployerCommand(event)
}

function validateDeployerInput(input: DeployerInput) {
  Object.entries(input).forEach(([key, value]) => {
    if (typeof value !== 'string' || value === '') {
      throw new Error(`No value passed for '${key}'`)
    }
  })
}

async function runDeployerCommand({
  command,
  app,
  regcode,
  stage,
}: DeployerInput) {
  const makeArgs = [
    command,
    `app=${app}`,
    `regcode=${regcode}`,
    `stage=${stage}`,
    'write_dir=/tmp',
  ]

  const { status } = spawnSync('make', makeArgs, {
    stdio: 'inherit',
    cwd: '/app',
  })

  if (status !== 0) {
    throw new Error(`Deployer failed with exit code: '${status}'`)
  }
}
