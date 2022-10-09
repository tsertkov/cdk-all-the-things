# input params

stage := dev
app := deployer
region := *
image_tag := latest

# vars

image_name := infra
image_platform := linux/amd64
config_file := config.yaml
secrets_sops_file := secrets.sops.yaml
secrets_file := secrets.yaml
secret_name := deployer/age-key
key_file := key.txt
stacks := *-$(stage)-$(region)/$(app)
app_ext := $(shell test ! -f Dockerfile && echo js || echo ts)
infra_cmd := cd infra && INFRA_APP=$(app) npx cdk -a bin/infra.$(app_ext)
apps ?= $(shell yq '.apps' $(config_file) | sed 's/- //' | xargs)
apps_r ?= $(shell echo $(apps) | awk '{ for (i = NF; i > 0; i = i - 1) printf("%s ", $$i); printf("\n")}')
project ?= $(shell yq '.common.project' $(config_file))

# functions

define iterate_apps
	for app in $(apps); do $(MAKE) -s app=$$app $(1); done
endef

### list commands

.PHONY: ls
ls:
	@$(infra_cmd) ls $(stacks)

.PHONY: lsa
lsa:
	@$(infra_cmd) ls "**"

PHONY: lsa-all
lsa-all:
	@$(call iterate_apps,lsa)

### build commands

PHONY: init
init:
	@cd infra && npm i

.PHONY: ci
ci: clean build-lambdas build-infra

.PHONY: build-lambdas
build-lambdas:
	@cd lambdas/go-app && make build

.PHONY: build-infra
build-infra:
	@docker build --platform $(image_platform) -t $(image_name):$(image_tag) .

### clean commands

.PHONY: clean
clean:
	@$(MAKE) -s clean-lambdas
	@$(MAKE) -s clean-secrets

.PHONY: clean-secrets
clean-secrets:
	@rm -f $(key_file) $(secrets_file)

.PHONY: clean-lambdas
clean-lambdas:
	@rm -rf lambdas/*/bin/*

### secrets commands

$(key_file):
	@aws secretsmanager describe-secret --secret-id $(project)/$(secret_name) > /dev/null
	@aws secretsmanager get-secret-value --secret-id $(project)/$(secret_name) --query SecretString --output text > $(key_file)

.PHONY: $(secrets_file)
$(secrets_file): $(key_file)
	@SOPS_AGE_KEY_FILE=$(key_file) sops -d $(secrets_sops_file) > $(secrets_file)

.PHONY: secrets
secrets: $(secrets_file)

.PHONY: secrets-edit
secrets-edit: $(key_file)
	@SOPS_AGE_KEY_FILE=$(key_file) sops $(secrets_sops_file)
	@$(MAKE) -s clean-secrets
	@$(MAKE) -s secrets

.PHONY: secrets-aws-update
secrets-aws-update: secrets
	@./infra/scripts/aws-secrets.sh update "$(stage)" "$(app)" "$(region)"

.PHONY: secrets-aws-delete
secrets-aws-delete: secrets
	@./infra/scripts/aws-secrets.sh delete "$(stage)" "$(app)" "$(region)"

### cdk commands

.PHONY: diff
diff: secrets
	@$(infra_cmd) diff $(stacks)

.PHONY: diff-all
diff-all:
	@$(call iterate_apps,diff)

.PHONY: deploy
deploy: secrets
	@$(infra_cmd) deploy $(stacks)
	@$(MAKE) -s secrets-aws-update

.PHONY: deploy-all
deploy-all:
	@$(call iterate_apps,deploy)

.PHONY: destroy
destroy:
	@test "$(shell read -p "Are you sure you want to delete: $(stacks) (y/n)? " confirmed; echo $$confirmed)" = "y" \
		&& (($(infra_cmd) destroy -f $(stacks)) && $(MAKE) -s secrets-aws-delete) || true

.PHONY: destroy-all
destroy-all:
	@$(call iterate_apps,destroy)

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
	@$(call iterate_apps,outputs)
