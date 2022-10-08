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

apps ?= $(shell yq '.apps' config.yaml | sed 's/- //' | xargs)
apps_r ?= $(shell echo $(apps) | awk '{ for (i = NF; i > 0; i = i - 1) printf("%s ", $$i); printf("\n")}')
project ?= $(shell yq '.common.project' config.yaml)
stacks := *-$(stage)-$(region)/$(app)
infra_cmd := cd infra && INFRA_APP=$(app) npx cdk -a bin/infra.$(app_ext)
secret_name := deployer/age-key
key_file := key.txt

# tasks

all: lsa-all

PHONY: lsa-all
lsa-all:
	@for app in $(apps); do $(MAKE) -s app=$$app lsa; done

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

$(key_file):
	@aws secretsmanager describe-secret --secret-id $(project)/$(secret_name) > /dev/null
	@aws secretsmanager get-secret-value --secret-id $(project)/$(secret_name) --query SecretString --output text > $(key_file)

.PHONY: secrets.yaml
secrets.yaml: $(key_file)
	@SOPS_AGE_KEY_FILE=$(key_file) sops -d secrets.sops.yaml > secrets.yaml

.PHONY: secrets
secrets: secrets.yaml

.PHONY: sops
sops: $(key_file)
	@SOPS_AGE_KEY_FILE=$(key_file) sops secrets.sops.yaml

.PHONY: secrets-aws-update
secrets-aws-update: secrets
	@./infra/scripts/aws-secrets.sh update $(stage) $(app)

.PHONY: secrets-aws-delete
secrets-aws-delete: secrets
	@./infra/scripts/aws-secrets.sh delete $(stage) $(app)

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
	@$(MAKE) -s secrets-aws-update

.PHONY: destroy
destroy:
	@test "$(shell read -p "Are you sure you want to delete: $(stacks) (y/n)? " confirmed; echo $$confirmed)" = "y" \
		&& (($(infra_cmd) destroy -f $(stacks)) && $(MAKE) -s secrets-aws-delete) || true

.PHONY: destroy-all
destroy-all:
	@for app in $(apps_r); do $(MAKE) -s app=$$app destroy; done

.PHONY: metadata
metadata:
	@$(infra_cmd) metadata $(stacks)

.PHONY: outputs
outputs:
	@for stack in $(shell $(infra_cmd) ls $(stacks) 2>/dev/null); do \
		echo $$stack:; \
		./infra/scripts/stack-outputs.sh $$stack; \
	done

.PHONY: outputs-all
outputs-all:
	@for app in $(apps); do $(MAKE) -s app=$$app outputs; done
