import {
  spawnSync,
  SpawnSyncOptions,
  SpawnSyncReturns,
} from 'node:child_process'

export type SpawnSyncFunction = (
  command: string,
  args?: ReadonlyArray<string>,
  options?: SpawnSyncOptions
) => SpawnSyncReturns<string | Buffer>

export async function runMake(
  makeArgs: string[],
  spawn: SpawnSyncFunction = spawnSync
) {
  const { status } = spawn('make', makeArgs, {
    stdio: 'inherit',
    cwd: '/app',
  })

  if (status === null) {
    throw new Error('Spawn status is null')
  }

  return status
}
