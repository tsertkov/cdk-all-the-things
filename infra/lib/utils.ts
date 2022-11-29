import * as path from 'path'
import { Code } from 'aws-cdk-lib/aws-lambda'
import type { StackBase } from './stack-base.js'
import type { NestedStackBase } from './nested-stack-base.js'

export interface DeterministicNameComponents {
  readonly name?: string
  readonly project?: string
  readonly region?: string | null
  readonly stage?: string
  readonly app?: string | null
  readonly separator?: string
  readonly append?: string
}

export function deterministicName(
  components: DeterministicNameComponents,
  stack?: StackBase | NestedStackBase
): string {
  const separator = components.separator || '-'
  const project = components.project || stack?.config.project
  const stage = components.stage || stack?.config.stageName
  const app = components.app === null || stack?.config.appName
  const regcode =
    components.region !== null
      ? regionToCode(components.region || stack?.region || '')
      : null

  const requiredComponentsSet = project && stage
  if (!requiredComponentsSet) {
    throw new Error('Not all required name components were given')
  }

  return [project, stage, regcode, app, components.name, components.append]
    .filter((v) => typeof v === 'string' && v?.length)
    .join(separator)
}

export function regionToCode(region: string): string {
  const parts = region.split('-')

  if (typeof parts[1] === 'undefined') {
    throw new Error(`Invalid region: '${region}'`)
  }

  if (parts[1] === 'southeast') {
    parts[1] = 'se'
  } else if (parts[1] === 'northeast') {
    parts[1] = 'ne'
  } else {
    parts[1] = parts[1].substring(0, 1)
  }

  return parts.join('')
}

export function codeFromDir(rootDir: string, relPath: string): Code {
  return Code.fromAsset(path.join(rootDir, 'lambdas', relPath))
}
