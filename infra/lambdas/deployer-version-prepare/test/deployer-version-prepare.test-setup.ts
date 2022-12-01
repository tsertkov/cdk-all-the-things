const lambdaProbeDelayMs = 10
const lambdaVersionsToKeep = 1

process.env['LAMBDA_PROBE_DELAY_MS'] = lambdaProbeDelayMs.toString()
process.env['LAMBDA_VERSIONS_TO_KEEP'] = lambdaVersionsToKeep.toString()

export { lambdaProbeDelayMs, lambdaVersionsToKeep }
