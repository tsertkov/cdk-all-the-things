package api

import (
	"github.com/gin-gonic/gin"
	"github.com/tsertkov/cdk-go-lambdas/config"
	"github.com/tsertkov/cdk-go-lambdas/controllers"
)

func NewRouter(appConfig config.Api) *gin.Engine {
	router := gin.Default()

	healthCtrl := controllers.NewHealth(appConfig)

	api := router.Group(appConfig.UrlPrefix)
	registerHealthRoutes(api, healthCtrl)

	return router
}

func registerHealthRoutes(r *gin.RouterGroup, c *controllers.Health) {
	/**
	 * @api {get} /status Status
	 */
	r.GET("/status", c.Status)

	/**
	 * @api {get} /healthcheck Healthcheck
	 */
	r.GET("/healthcheck", c.Healthcheck)
}
