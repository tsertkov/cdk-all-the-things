.PHONY: build test run

GOCLIENV=CGO_ENABLED=0 GOOS=linux GOARCH=amd64
GOBUILDRGS=-tags nomsgpack -ldflags="-s -w"

build: test
	$(GOCLIENV) go build $(GOBUILDRGS) -o bin/engine/engine ./cmd/engine
	$(GOCLIENV) go build $(GOBUILDRGS) -o bin/api/api ./cmd/api

test:
	go test .

run:
	PORT=8080 URL_PREFIX="$$(cat ../../config.json | jq -r .apiResourceName)" go run ./cmd/local
