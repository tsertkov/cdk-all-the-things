import * as path from 'path'
import { Duration, Stack, StackProps } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'

export class CdkGoLambdasStack extends Stack {
  apiLambda: lambda.Function
  apiLambdaAlias: lambda.Alias
  apiGateway: apigateway.LambdaRestApi
  dynamoDb: dynamodb.Table

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)
    this.initBookDynamoTable()
    this.initApiLambda()
    this.initApiGateway()
  }

  initBookDynamoTable () {
    this.dynamoDb = new dynamodb.Table(this, 'BookDynamoTable', {
      partitionKey: {
        name: 'client_id',
        type: dynamodb.AttributeType.STRING,
      },
    })
  }

  initApiGateway () {
    this.apiGateway = new apigateway.LambdaRestApi(this, 'LambdaRestApi', {
      restApiName: 'GoLambdaRestApi',
      handler: this.apiLambdaAlias,
      proxy: true,
    })
  }

  initApiLambda () {
    const code = lambda.Code.fromAsset(path.join(__dirname, '../..', 'lambdas/api/bin'))

    this.apiLambda = new lambda.Function(this, 'ApiLambda', {
      runtime: lambda.Runtime.GO_1_X,
      architecture: lambda.Architecture.X86_64,
      timeout: Duration.seconds(15),
      handler: 'main',
      environment: {
        BOOK_TABLE_NAME: this.dynamoDb.tableName,
      },
      code,
    })

    this.apiLambdaAlias = new lambda.Alias(this, 'ApiLambdaAlias', {
      aliasName: 'live',
      version: this.apiLambda.currentVersion,
    })
  }
}
