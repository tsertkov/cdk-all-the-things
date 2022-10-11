# CDK All The Things

Multi-region, multi-environment AWS CDK and Golang cloud application playground.

## Prerequisites

Tools: make, nodejs, docker, sops, aws-cli, awk, sed, xargs, [yq](https://github.com/mikefarah/yq), [age](https://github.com/FiloSottile/age).

## Usage

Follow bootstrapping instructions to prepare local and aws environment. Use make commands to run operations.

### Bootstrapping

- `git clone ...` - Clone this git repo
- Edit configuration parameters in `config.yaml`
- `make init` - Install dependencies
- `make bootstrap-cdk` - Bootstrap cdk for all apps regions
- `make bootstrap-github-oidc` - Optionally bootstrap github oidc if Github Actions are used for deployments
- `make bootstrap-secret-key` - Generage age secret key and store it in the cloud
- `cp secrets-example.yaml secrets.yaml && make secrets-encrypt` - Encrypt provided example secrets

### Make commands

Bootstrap commands:

- `make init` - install infra dependencies
- `make bootstrap-cdk` - bootstrap cdk for all apps regions
- `make bootstrap-github-oidc` - deploy cfn stack with github oidc
- `make bootstrap-secret-key` - generate age secret key and store it in the cloud

App stack list commands:

- `make ls` - list infra stacks for given region
- `make lsa` - list infra stacks for all regions
- `make lsa-all` - list all stacks for all apps
- `make metadata` - show stacks metadata

Build commands:

- `make ci` - build all
- `make build-lambdas` - build lambdas
- `make build-infra` - build infra deployer container image
- `make clean` - remove compiled lambdas and decrypted secrets
- `make clean-secrets` - remove decrypted secrets file
- `make clean-lambdas` - remove compiled lambdas

Secrets commands:

- `make secrets-decrypt` - decrypt secrets into plan text file
- `make secrets-encrypt` - encrypt secrets from plan text file
- `make secrets-edit` - edit encrypted secrets file or create new
- `make secrets-aws-update` - set secrets in aws from decrypted secrets
- `make secrets-aws-delete` - delete secrets in aws set from decrypted secrets

Cdk diff commands:

- `make diff` - diff infra changes
- `make diff-all` - diff infra changes for all apps

Cdk deploy commands:

- `make deploy` - deploy infra & lambdas
- `make deploy-all` - deploy infra & lambdas for all apps

Cloudformation outputs:

- `make outputs` - display stack outputs
- `make outputs-all` - display stack outputs from all apps for given region

Cdk destroy commands:

- `make destroy` - destroy stacks
- `make destroy-all` - destroy stacks from all apps

## Infrastructure environments

Stages and their environment configurations are defined under `stages` section in `config.yaml`.

## App suite deployment diagram

Cloud apps:

- `deployer-gl` - apps deployer (single-region)
- `monitor-gl` - monitor app (single-region)
- `monitor` - monitor app (multi-regional)
- `be` - backend api app (multi-regional)
- `fe` - frontend app (single-region)

![194943188-93bd70ae-7b05-4505-b149-3b922e76cbb1 drawio (2)](https://user-images.githubusercontent.com/5339042/194963466-5958ac32-8de8-4d9e-8986-29c06a9201a2.svg)

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
