import * as path from 'path'
import { IConstruct } from 'constructs'
import { Tags, Stack } from 'aws-cdk-lib'
import { Code } from 'aws-cdk-lib/aws-lambda'

export function deterministicName (stack: Stack, name: string): string {
  return Stack.of(stack).nestedStackParent
    ? Stack.of(stack).nestedStackParent?.stackName + '-' + name
    : Stack.of(stack).stackName + '-' + name
}

export function setNameTag (scope: IConstruct, name: string) {
  Tags.of(scope).add(
    'Name',
    deterministicName(
      Stack.of(scope),
      name,
    ),
  )
}

export function regionToCode (region: string): string {
  const parts = region.split('-')

  if (parts[1] === 'southeast') {
    parts[1] = 'se'
  } else if (parts[1] === 'northeast') {
    parts[1] = 'ne'
  } else {
    parts[1] = parts[1][0]
  }

  return parts.join('')
}

export function codeFromDir (rootDir: string, relPath: string): Code {
  return Code.fromAsset(path.join(rootDir, 'lambdas', relPath))
}
