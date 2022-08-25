package main

import (
	"log"

	"github.com/tsertkov/cdk-go-lambdas/api"
	"github.com/tsertkov/cdk-go-lambdas/config"
)

func main() {
	appConfig := config.NewApi()
	router := api.NewRouter(appConfig)
	if err := router.Run(); err != nil {
		log.Printf("error starting server %+v", err)
	}
}
