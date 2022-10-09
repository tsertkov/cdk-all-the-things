# CDK All The Things

Multi-region, multi-environment AWS CDK and Golang cloud application playground.

## Prerequisites

Tools: make, nodejs, docker, aws-cli, awk, sed, xargs, [yq](https://github.com/mikefarah/yq)

[age](https://github.com/FiloSottile/age) key (see [infra-bootstrap](./infra-bootstrap/README.md))

## Usage

1) Clone `git` repo
2) Install dependencies by running `make init`
3) Run commands with `make`

Commands:

- `make init` - install infra dependencies
- `make ls` - list infra stacks for given region
- `make lsa` - list infra stacks for all regions
- `make lsa-all` - list all stacks for all apps
- `make ci` - build all
- `make build-lambdas` - build lambdas
- `make build-infra` - build infra deployer container image
- `make secrets` - unencrypt secrets into plan text file
- `make secrets-edit` - edit encrypted secrets file
- `make secrets-aws-update` - set secrets in aws from unencrypted secrets
- `make secrets-aws-delete` - delete secrets in aws set from unencrypted secrets
- `make clean` - remove compiled lambdas and unencrypted secrets
- `make clean-secrets` - remove unencrypted secrets file
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

## Containerized deployer

Automated pipelines use deployer container image to execute deployments.

```bash
# build lambdas and infra deployer container image
% make lambdas infra

# run simple command
% docker run --rm -it infra lsall

# run command with AWS access
% docker run --rm -it \
    -e AWS_ACCESS_KEY_ID \
    -e AWS_SECRET_ACCESS_KEY \
    infra app=be diff

# run command with custom config file
% docker run --rm -it \
    -v $PWD/config.toml:/app/config.toml \
    infra app=be lsa
```
