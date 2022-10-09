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
secret_region := eu-central-1
key_file := key.txt
public_key ?= $(shell grep '^\# public key: ' key.txt | sed 's/^.*: //')
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

### init commands

PHONY: init
init:
	@cd infra && npm i

.PHONY: bootstrap-github-oidc
bootstrap-github-oidc:
	@aws cloudformation create-stack \
		--stack-name github-oidc \
		--template-body file://infra/bootstrap/github-oidc.cfn.yaml

.PHONY: bootstrap-secret-key
bootstrap-secret-key: secret_create_or_update_args := $(project)/$(secret_name) --region $(secret_region) --secret-string "$$(cat $(key_file))"
bootstrap-secret-key:
	@test -f $(key_file) && echo "Secrets key file already exits" && exit 1 ; \
	age-keygen -o $(key_file); \
	aws secretsmanager create-secret --name $(secret_create_or_update_args) 2>/dev/null \
		||	aws secretsmanager update-secret --secret-id $(secret_create_or_update_args)

### build commands

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
	@aws secretsmanager describe-secret \
		--region $(secret_region) \
		--secret-id $(project)/$(secret_name) \
		> /dev/null
	@aws secretsmanager get-secret-value \
		--region $(secret_region) \
		--secret-id $(project)/$(secret_name) \
		--query SecretString \
		--output text \
		> $(key_file)

.PHONY: $(secrets_file)
$(secrets_file): $(key_file)
	@SOPS_AGE_KEY_FILE=$(key_file) sops -d $(secrets_sops_file) > $(secrets_file)

.PHONY: secrets-decrypt
secrets-decrypt: $(secrets_file)

.PHONY: secrets-encrypt
secrets-encrypt: $(key_file)
	@test ! -f $(secrets_file) && echo $(secrets_file) does not exists && exit 1; \
	SOPS_AGE_KEY_FILE=$(key_file) sops -e --age $(public_key) $(secrets_file) > $(secrets_sops_file)

.PHONY: secrets-edit
secrets-edit: $(key_file)
	@SOPS_AGE_KEY_FILE=$(key_file) sops --age $(public_key) $(secrets_sops_file)

.PHONY: secrets-aws-update
secrets-aws-update: secrets
	@./infra/scripts/aws-secrets.sh update "$(stage)" "$(app)" "$(region)"

.PHONY: secrets-aws-delete
secrets-aws-delete: secrets
	@./infra/scripts/aws-secrets.sh delete "$(stage)" "$(app)" "$(region)"

### cdk commands

.PHONY: diff
diff: secrets-decrypt
	@$(infra_cmd) diff $(stacks)

.PHONY: diff-all
diff-all:
	@$(call iterate_apps,diff)

.PHONY: deploy
deploy: secrets-decrypt
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
