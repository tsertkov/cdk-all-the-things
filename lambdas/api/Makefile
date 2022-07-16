.PHONY: build
build:
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -tags nomsgpack -ldflags="-s -w" main/lambda.go -o bin/main .
run:
	PORT=8080 go run main/local.go
