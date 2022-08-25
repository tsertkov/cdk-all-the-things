# input params

app := deployer
stage := dev
region := *
image_tag := latest

# vars

ifeq ($(shell test ! -f Dockerfile && echo -n yes),yes)
	app_ext := js
else
	app_ext := ts
endif

stacks := *-$(stage)-$(region)/$(app)
infra_cmd := cd infra && INFRA_APP=$(app) npx cdk -a bin/infra.$(app_ext)
secret_name := deployer/age-key
key_file := key.txt

# tasks

all: lsall

PHONY: lsal lsall
lsal lsall:
	@echo % make app=deployer lsa
	@$(MAKE) -s app=deployer lsa
	@echo % make app=be lsa
	@$(MAKE) -s app=be lsa
	@echo % make app=monitor lsa
	@$(MAKE) -s app=monitor lsa

.PHONY: ls
ls:
	@$(infra_cmd) ls $(stacks)

.PHONY: lsa
lsa:
	@$(infra_cmd) ls "**"

PHONY: init
init:
	@cd infra && npm i

.PHONY: ci
ci: clean lambdas infra

.PHONY: clean
clean:
	@rm -rf lambdas/*/bin/*
	@rm -f $(key_file) secrets.yaml

$(key_file): project := $(shell yq '.common.project' config.yaml)
$(key_file):
	@aws secretsmanager describe-secret --secret-id $(project)/$(secret_name) > /dev/null
	@aws secretsmanager get-secret-value --secret-id $(project)/$(secret_name) --query SecretString --output text > $(key_file)

secrets.yaml: $(key_file)
	@SOPS_AGE_KEY_FILE=$(key_file) sops -d secrets.sops.yaml > secrets.yaml

.PHONY: secrets
secrets: secrets.yaml

.PHONY: sops
sops: $(key_file)
	@SOPS_AGE_KEY_FILE=$(key_file) sops secrets.sops.yaml

.PHONY: lambdas
lambdas:
	@cd lambdas/go-app && make build

.PHONY: infra
infra:
	@docker build --platform linux/amd64 -t infra:$(image_tag) .

.PHONY: diff
diff: secrets
	@$(infra_cmd) diff $(stacks)

.PHONY: deploy
deploy: secrets
	@$(infra_cmd) deploy $(stacks)

.PHONY: destroy
destroy:
	@$(infra_cmd) destroy $(stacks)
