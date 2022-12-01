### input params

stage := dev
app := deployer-glb
regcode := *
image_tag := latest
write_dir := $(CURDIR)

### vars

.SECONDARY :
.SHELLFLAGS := -eu -c
SHELL := sh

project ?= $(shell yq '.project' $(config_file))
project_lc ?= $(shell echo $(project) | tr '[:upper:]' '[:lower:]')
image_name := infra
image_platform := linux/amd64
config_file := config.yaml
secrets_enabled ?= $(shell yq .secrets.enabled $(config_file))
secrets_dir := $(write_dir)/secrets
encrypted_secrets_dir := secrets/encrypted
sops_key_file := $(secrets_dir)/.keys/key-$(stage).txt
sops_cmd := SOPS_AGE_KEY_FILE=$(sops_key_file) sops
key_secret_name := $(project)/$(stage)/age-key
key_secret_region ?= $(shell yq '.secrets.keyRegion' $(config_file))
public_key ?= $(shell grep '^\# public key: ' $(sops_key_file) | sed 's/^.*: //')
stacks := *-$(stage)-$(regcode)/$(app)
infra_cmd := cd infra && SECRETS_DIR_PATH=$(write_dir) INFRA_ROOT=$(CURDIR) INFRA_APP=$(app) npx cdk -o $(write_dir)/infra/cdk.out
docker_build_args ?= $(shell cat docker-build-args.txt | grep -v '^\(\#.*\)\?$$' | xargs -L1 echo --build-arg | xargs)
aws_secrets_cmd := scripts/aws-secrets.sh
stack_outputs_cmd := scripts/stack-outputs.sh
apps ?= $(shell echo deployer-glb && yq '.apps | flatten()' $(config_file) | sed 's/- //' | xargs)
aws_account_id ?= $(shell aws sts get-caller-identity --query Account --output text)
all_regions ?= $(shell \
	yq '. | to_entries | (.[].value.[].[].[], .[].value.[].[]) | select(key == "regions") | .[]' \
		$(config_file) | sort | uniq)
deployer_region ?= $(shell \
	yq '(.deployer-glb.stages.$(stage).regions // .deployer-glb.common.regions)[]' $(config_file))
ecr_initial_image := public.ecr.aws/lambda/nodejs:18
ecr_repo_uri ?= $(shell \
	aws ecr describe-repositories \
		--repository-names $(project_lc)-$(stage)-deployer \
		--output text --query 'repositories[0].repositoryUri' \
	):initial
ecr_max_image_count ?= $(shell \
	yq '.bootstrap.deployer-ecr.stages.$(stage).ecr_max_image_count // .bootstrap.deployer-ecr.common.ecr_max_image_count' \
		$(config_file))
ecr_image_mutability ?= $(shell \
	yq '.bootstrap.deployer-ecr.stages.$(stage).image_mutability // .bootstrap.deployer-ecr.common.image_mutability' \
		$(config_file))

# init secrets flags
ifeq ($(secrets_enabled),true)
	ifneq (,$(wildcard $(encrypted_secrets_dir)/config-$(stage).sops.yaml))
		has_secret_config = true
	endif
	ifneq (,$(wildcard $(encrypted_secrets_dir)/secrets-$(stage).sops.yaml))
		has_secrets = true
	endif
endif

# get app region(s) to work with
ifeq ($(regcode),*)
	regions = $(shell yq '.$(app).stages.$(stage).regions // .$(app).common.regions' $(config_file) | sed 's/- //')
else
	regions = $(shell source scripts/functions.sh && region_by_code $(regcode))
endif

# functions

define iterate_apps
	for app in $(apps); do $(MAKE) -s app=$$app $(1); done
endef

### list commands

.PHONY: ls
ifeq ($(has_secret_config),true)
ls: sops-decrypt-config
endif
ls:
	@$(infra_cmd) ls $(stacks)

.PHONY: lsa
ifeq ($(has_secret_config),true)
lsa: sops-decrypt-config
endif
lsa:
	@$(infra_cmd) ls "**"

.PHONY: lsa-all
lsa-all:
	@$(call iterate_apps,lsa)

### init commands

.PHONY: init
init:
	@cd infra && npm i

.PHONY: bootstrap-cdk
bootstrap-cdk:
	@cd infra && for region in $(all_regions); do \
		echo $(aws_account_id)/$$region; \
	done | xargs npx cdk bootstrap

.PHONY: bootstrap-github-oidc
bootstrap-github-oidc:
	@aws cloudformation create-stack \
		--stack-name github-oidc \
		--template-body file://infra/bootstrap/github-oidc.cfn.yaml

.PHONY: bootstrap-secret-key
bootstrap-secret-key: secret_create_or_update_args := $(key_secret_name) --region $(key_secret_region) --secret-string "$$(cat $(sops_key_file))"
bootstrap-secret-key:
	@test -f $(sops_key_file) \
		&& echo "Secrets key file already exits: '$(sops_key_file)'" \
		&& exit 1 ; \
	age-keygen -o $(sops_key_file); \
	aws secretsmanager create-secret --name $(secret_create_or_update_args) 2>/dev/null \
		||	aws secretsmanager update-secret --secret-id $(secret_create_or_update_args)

.PHONY: bootstrap-deployer-ecr
bootstrap-deployer-ecr:
	$(info Creating deployer ecr repository for $(stage))
	@aws ecr describe-repositories --repository-names $(project_lc)-$(stage)-deployer > /dev/null || \
		aws ecr create-repository --repository-name $(project_lc)-$(stage)-deployer \
			--image-tag-mutability $(ecr_image_mutability) \
			--image-scanning-configuration '{ "scanOnPush": true }' \
			--tags Key=appname,Value=$(app) Key=project,Value=$(project) Key=stage,Value=$(stage)
	$(info Setting lifecycle policy for ecr repository)
	@aws ecr put-lifecycle-policy --repository-name $(project_lc)-$(stage)-deployer \
		--query lifecyclePolicyText --output text \
		--lifecycle-policy-text '{ "rules": [{ \
				"rulePriority": 1, \
				"selection": { \
					"tagStatus": "any", \
					"countType": "imageCountMoreThan", \
					"countNumber": $(ecr_max_image_count) \
				}, \
				"action": { \
					"type": "expire" \
				} \
		}]}'

.PHONY: bootstrap-initial-deployer
bootstrap-initial-deployer: bootstrap-deployer-ecr
	$(info Upload initial deployer container image for $(stage))
	@$(aws ecr get-login --no-include-email --region $(deployer_region))
	@docker pull $(ecr_initial_image)
	@docker tag $(ecr_initial_image) $(ecr_repo_uri)
	@docker push $(ecr_repo_uri)

### build commands

.PHONY: build
build: clean build-lambdas build-infra

.PHONY: build-lambdas
build-lambdas:
	@cd lambdas/go-app && make build

.PHONY: build-infra
build-infra:
	@DOCKER_BUILDKIT=1 docker build \
		--platform $(image_platform) \
		$(docker_build_args) \
		-t $(image_name):$(image_tag) \
		.

### clean commands

.PHONY: clean
clean:
	@$(MAKE) -s clean-lambdas
	@$(MAKE) -s clean-secrets

.PHONY: clean-secrets
clean-secrets:
	$(info Removing decrypted secret files)
	@rm -f $(sops_key_file) $(secrets_dir)/{config,secrets}-*.yaml

.PHONY: clean-lambdas
clean-lambdas:
	$(info Removing compiled lambdas)
	@rm -rf lambdas/*/bin/*

### secrets commands

$(sops_key_file):
	$(info Fetching secret key: $(key_secret_name) to: $(sops_key_file))
	@mkdir -p $(shell dirname $(sops_key_file))
	@aws secretsmanager describe-secret \
		--region $(key_secret_region) \
		--secret-id $(key_secret_name) \
		> /dev/null || exit 1 && \
	aws secretsmanager get-secret-value \
		--region $(key_secret_region) \
		--secret-id $(key_secret_name) \
		--query SecretString \
		--output text \
		> $(sops_key_file)

sops-edit-%: $(sops_key_file)
	@$(sops_cmd) --age $(public_key) $(encrypted_secrets_dir)/$(*)-$(stage).sops.yaml

.PHONY: sops-encrypt-%
sops-encrypt-%: $(sops_key_file) check-secret-file-exists-%-$(stage)
	@$(sops_cmd) -e --age $(public_key) $(secrets_dir)/$(*)-$(stage).yaml \
		> $(encrypted_secrets_dir)/$(*)-$(stage).sops.yaml

.PHONY: sops-decrypt-%
sops-decrypt-%: $(sops_key_file) check-encrypted-secret-file-exists-%-$(stage)
	@$(sops_cmd) -d $(encrypted_secrets_dir)/$(*)-$(stage).sops.yaml \
		> $(secrets_dir)/$(*)-$(stage).yaml

.PHONY: secrets-aws-update
secrets-aws-update: sops-decrypt-secrets
	@for region in $(regions); do \
		$(aws_secrets_cmd) update "$(project)/$(stage)/$(app)/" "$$region" "$(app)" "$(secrets_dir)/secrets-$(stage).yaml"; \
	done

.PHONY: secrets-aws-delete
secrets-aws-delete:
	@for region in $(regions); do \
		$(aws_secrets_cmd) delete "$(project)/$(stage)/$(app)/" "$$region"; \
	done

### cdk commands

.PHONY: diff
ifeq ($(has_secret_config),true)
diff: sops-decrypt-config
endif
diff:
	@$(infra_cmd) diff $(stacks)

.PHONY: diff-all
diff-all:
	@$(call iterate_apps,diff)

.PHONY: deploy
ifeq ($(has_secret_config),true)
deploy: sops-decrypt-config
	@$(infra_cmd) deploy $(stacks)
	@$(MAKE) -s secrets-aws-update
else
deploy:
	@$(infra_cmd) deploy $(stacks)
endif

.PHONY: deploy-all
deploy-all:
	@$(call iterate_apps,deploy)

.PHONY: destroy
destroy:
	@test "$$(read -p "Are you sure you want to delete: $(stacks) (y/n)? " confirmed; echo $$confirmed)" = "y" \
		&& (($(infra_cmd) destroy -f $(stacks)) && $(MAKE) -s secrets-aws-delete) || true

.PHONY: destroy-all
destroy-all:
	@$(call iterate_apps,destroy)

.PHONY: metadata
metadata:
	@$(infra_cmd) metadata $(stacks)

.PHONY: outputs
outputs:
	@for stack in $$($(infra_cmd) ls $(stacks) 2>/dev/null); do \
		echo $$stack:; \
		$(stack_outputs_cmd) $$stack; \
	done

.PHONY: outputs-all
outputs-all:
	@$(call iterate_apps,outputs)

### validation targets

.PHONY: check-secret-file-exists-%
check-secret-file-exists-%:
	@test -f "$(secrets_dir)/$(*).yaml" \
		|| ( \
			echo "Required file does not exist: $(secrets_dir)/$(*).yaml" \
			&& exit 1 \
		)

.PHONY: check-encrypted-secret-file-exists-%
check-encrypted-secret-file-exists-%:
	@test -f "$(encrypted_secrets_dir)/$(*).sops.yaml" \
		|| ( \
			echo "Required file does not exist: $(encrypted_secrets_dir)/$(*).sops.yaml" \
			&& exit 1 \
		)
