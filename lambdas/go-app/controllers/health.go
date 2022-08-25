package controllers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tsertkov/cdk-go-lambdas/config"
)

type Health struct {
	appConfig config.Api
}

func NewHealth(appConfig config.Api) *Health {
	return &Health{
		appConfig,
	}
}

func (h *Health) Status(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "ok",
		"stage":  h.appConfig.StageName,
		"region": h.appConfig.RegionName,
	})
}

func (h *Health) Healthcheck(c *gin.Context) {
	c.String(http.StatusOK, "Ok")
}
