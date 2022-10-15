import { Duration } from 'aws-cdk-lib'
import { Alarm, ComparisonOperator } from 'aws-cdk-lib/aws-cloudwatch'
import { Function as Lambda } from 'aws-cdk-lib/aws-lambda'
import { StackBase } from './stack-base'
import { deterministicName } from './utils'

export enum LambdaMetric {
  ERRORS = 'errors',
  DURATION = 'duration',
}

interface LambdaMetricAlarm {
  metric: LambdaMetric
  period?: Duration
  threshold?: number
  evaluationPeriods?: number
  comparisonOperator?: ComparisonOperator
}

export interface LambdaMetricAlarmsProps {
  stack: StackBase
  id: string
  lambda: Lambda
  metricAlarms: LambdaMetricAlarm[]
}

function addLambdaErrorsMetricAlarm(
  stack: StackBase,
  id: string,
  lambda: Lambda,
  {
    period = Duration.minutes(1),
    threshold = 1,
    evaluationPeriods = 1,
    comparisonOperator = ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
  }: LambdaMetricAlarm
) {
  const engineLambdaErrors = lambda.metricErrors({
    period,
  })

  const name = `${id}Errors`
  new Alarm(stack, name, {
    alarmName: deterministicName({ name }, stack),
    metric: engineLambdaErrors,
    threshold,
    evaluationPeriods,
    comparisonOperator,
  })
}

function addLambdaDurationMetricAlarm(
  stack: StackBase,
  id: string,
  lambda: Lambda,
  {
    period = Duration.minutes(1),
    threshold = 1000,
    evaluationPeriods = 1,
    comparisonOperator = ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
  }: LambdaMetricAlarm
) {
  const engineLambdaDuration = lambda.metricDuration({
    period,
  })

  const name = `${id}Duration`
  new Alarm(stack, name, {
    alarmName: deterministicName({ name }, stack),
    metric: engineLambdaDuration,
    threshold,
    evaluationPeriods,
    comparisonOperator,
  })
}

export function addLambdaMetricAlarms({
  stack,
  id,
  lambda,
  metricAlarms,
}: LambdaMetricAlarmsProps) {
  metricAlarms.forEach((metricAlarm) => {
    switch (metricAlarm.metric) {
      case LambdaMetric.ERRORS:
        return addLambdaErrorsMetricAlarm(stack, id, lambda, metricAlarm)
      case LambdaMetric.DURATION:
        return addLambdaDurationMetricAlarm(stack, id, lambda, metricAlarm)
      default:
        throw Error(`Unhandled metric: '${metricAlarm.metric}'`)
    }
  })
}
