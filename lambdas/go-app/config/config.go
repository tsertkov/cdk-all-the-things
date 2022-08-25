package config

import "os"

type Base struct {
	StageName  string
	RegionName string
}

type Api struct {
	Base
	JobTableName string
	JobQueueName string
	UrlPrefix    string
}

type Engine struct {
	Base
}

func newBase() Base {
	return Base{
		StageName:  os.Getenv("STAGE_NAME"),
		RegionName: os.Getenv("REGION_NAME"),
	}
}

func NewEngine() Engine {
	return Engine{
		Base: newBase(),
	}
}

func NewApi() Api {
	return Api{
		Base:         newBase(),
		JobTableName: os.Getenv("JOB_TABLE_NAME"),
		JobQueueName: os.Getenv("JOB_QUEUE_NAME"),
		UrlPrefix:    os.Getenv("URL_PREFIX"),
	}
}
