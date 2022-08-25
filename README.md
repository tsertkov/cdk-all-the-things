# cdk-go-lambdas

Multi-region, multi-environment AWS CDK and Golang cloud application playground.

## Prerequisites

- make
- nodejs
- docker
- aws-cli
- [yq](https://github.com/mikefarah/yq)
- [age](https://github.com/FiloSottile/age) key (see [infra-bootstrap](./infra-bootstrap/README.md))

## Usage

1) Clone `git` repo
2) Install dependencies
3) Run tasks with `make`

```bash
# clone git repo
git clone https://github.com/tsertkov/cdk-go-lambdas.git

# install dependencies
make init

# run default task
make
```

Build commands:

- `make all` - build all
- `make lambdas` - build lambdas
- `make infra` - build infra deployer container image
- `make secrets` - unencrypt secrets.sops.yaml into secrets.yaml
- `make sops` - edit encrypted secrets.sops.yaml file
- `make clean` - remove compiled lambdas and secrets

CDK commands:

- `make lsal` - list all stacks for all apps
- `make ls` - list infra stacks
- `make diff` - diff infra changes
- `make deploy` - deploy infra & lambdas
- `make destroy` - destroy stacks
- `make app=be lsa` - list all stacks for be app

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
