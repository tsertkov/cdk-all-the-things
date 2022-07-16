.PHONY: *
build: clean
	(cd lambdas/api && make build)
clean:
	rm -rf lambdas/*/bin/*
diff:
	cd infra && cdk diff
deploy:
	cd infra && cdk deploy
