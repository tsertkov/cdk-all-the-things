package main

import (
	"context"
	"fmt"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/tsertkov/cdk-go-lambdas/config"
)

var appConfig config.Engine

func init() {
	appConfig = config.NewEngine()
}

func handler(ctx context.Context, sqsEvent events.SQSEvent) error {
	fmt.Println(appConfig)

	for _, message := range sqsEvent.Records {
		fmt.Printf("The message %s for event source %s = %s \n", message.MessageId, message.EventSource, message.Body)
	}

	return nil
}

func main() {
	lambda.Start(handler)
}
