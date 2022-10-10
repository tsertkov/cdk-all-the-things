# CDK All The Things

Multi-region, multi-environment AWS CDK and Golang cloud application playground.

## Prerequisites

Tools: make, nodejs, docker, sops, aws-cli, awk, sed, xargs, [yq](https://github.com/mikefarah/yq), [age](https://github.com/FiloSottile/age).

## Usage

Bootstrapping:

- `git clone ...` - Clone this git repo
- Edit configuration parameters in `config.yaml`
- `make init` - Install dependencies
- `make bootstrap-cdk` - Bootstrap cdk for all apps regions
- `make bootstrap-github-oidc` - Optionally bootstrap github oidc if Github Actions are used for deployments
- `make bootstrap-secret-key` - Generage age secret key and store it in the cloud
- `cp secrets-example.yaml secrets.yaml && make secrets-encrypt` - Encrypt provided example secrets

Make commands:

- `make init` - install infra dependencies
- `make bootstrap-cdk` - bootstrap cdk for all apps regions
- `make bootstrap-github-oidc` - deploy cfn stack with github oidc
- `make bootstrap-secret-key` - generate age secret key and store it in the cloud
- `make ls` - list infra stacks for given region
- `make lsa` - list infra stacks for all regions
- `make lsa-all` - list all stacks for all apps
- `make ci` - build all
- `make build-lambdas` - build lambdas
- `make build-infra` - build infra deployer container image
- `make secrets-decrypt` - decrypt secrets into plan text file
- `make secrets-encrypt` - encrypt secrets from plan text file
- `make secrets-edit` - edit encrypted secrets file or create new
- `make secrets-aws-update` - set secrets in aws from decrypted secrets
- `make secrets-aws-delete` - delete secrets in aws set from decrypted secrets
- `make clean` - remove compiled lambdas and decrypted secrets
- `make clean-secrets` - remove decrypted secrets file
- `make clean-lambdas` - remove compiled lambdas
- `make diff` - diff infra changes
- `make diff-all` - diff infra changes for all apps
- `make deploy` - deploy infra & lambdas
- `make deploy-all` - deploy infra & lambdas for all apps
- `make outputs` - display stack outputs
- `make outputs-all` - display stack outputs from all apps for given region
- `make metadata` - show stacks metadata
- `make destroy` - destroy stacks
- `make destroy-all` - destroy stacks from all apps

## Infrastructure environments

Stages and their environment configurations are defined under `stages` section in `config.yaml`.

## High level deployment diagram

Cloud applications:

- `deployer-gl` - apps deployer (single-region)
- `monitor-gl` - monitor app (single-region)
- `monitor` - monitor app (multi-regional)
- `be` - backend api app (multi-regional)
- `fe` - frontend app (single-region)

![194919832-e85ef35f-11ec-4da0-8b58-3869531f7faa drawio](https://user-images.githubusercontent.com/5339042/194942407-b3c1c0c5-1967-409a-b7c3-f3cf05522bcd.svg)

## Containerized deployer

Automated pipelines use deployer container image to execute deployments.

```bash
# build lambdas and infra deployer container image
% make lambdas infra

# run simple command
% docker run --rm -it infra lsa-all

# run command with AWS access
% docker run --rm -it \
    -e AWS_ACCESS_KEY_ID \
    -e AWS_SECRET_ACCESS_KEY \
    infra app=be diff

# run command with custom config file
% docker run --rm -it \
    -v $PWD/config.yaml:/app/config.yaml \
    infra app=be lsa
```
