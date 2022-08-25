package main

import (
	"context"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	ginadapter "github.com/awslabs/aws-lambda-go-api-proxy/gin"

	"github.com/tsertkov/cdk-go-lambdas/api"
	"github.com/tsertkov/cdk-go-lambdas/config"
)

var ginLambda *ginadapter.GinLambda

func init() {
	appConfig := config.NewApi()
	router := api.NewRouter(appConfig)
	ginLambda = ginadapter.New(router)
}

func HandleAPIGateway(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	return ginLambda.ProxyWithContext(ctx, req)
}

func main() {
	lambda.Start(HandleAPIGateway)
}
