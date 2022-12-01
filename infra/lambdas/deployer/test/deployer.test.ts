import type { SpawnSyncReturns } from 'node:child_process'
import { jest } from '@jest/globals'
import { DeployerInput, handler } from '../deployer.js'

describe('deployer lambda', () => {
  const spawnMock = createSpawnMock()
  const expectedWriteDir = '/tmp'
  const expectedCwd = '/app'
  const expectedStdio = 'inherit'

  describe('Given valid input', () => {
    const inputEvent: DeployerInput = {
      app: 'input-app',
      command: 'input-command',
      regcode: 'input-regcode',
      stage: 'input-stage',
    }

    it('should spawn make with event data', async () => {
      await handler(inputEvent, spawnMock)
      expect(spawnMock).toBeCalledWith(
        'make',
        [
          inputEvent.command,
          `app=${inputEvent.app}`,
          `regcode=${inputEvent.regcode}`,
          `stage=${inputEvent.stage}`,
          `write_dir=${expectedWriteDir}`,
        ],
        { cwd: expectedCwd, stdio: expectedStdio }
      )
    })

    describe('When spawned child process succeeds', () => {
      it('should not throw', () => {
        expect(handler(inputEvent, spawnMock)).resolves.not.toThrow()
      })
    })

    describe('When spawned child process fails', () => {
      it('should throw', () => {
        expect(handler(inputEvent, createSpawnMock(1))).rejects.toThrow()
      })
    })
  })

  describe('Given invalid input', () => {
    it('should throw', () => {
      expect(handler({} as DeployerInput, createSpawnMock())).rejects.toThrow()
    })
  })
})

/**
 * Create spawn function mock implementation
 */
function createSpawnMock(status = 0) {
  return jest.fn((): SpawnSyncReturns<string> => {
    return {
      pid: 0,
      output: ['output'],
      stdout: 'stdout',
      stderr: 'stderr',
      status,
      signal: null,
    }
  })
}
