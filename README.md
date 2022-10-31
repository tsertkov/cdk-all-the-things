# CDK All The Things

Multi-account, multi-region, multi-environment AWS CDK and Golang cloud application playground.

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

### Make commands

#### Bootstrap commands

- `make init` - install infra dependencies
- `make bootstrap-cdk` - bootstrap cdk for all apps regions
- `make bootstrap-github-oidc` - deploy cfn stack with github oidc
- `make bootstrap-secret-key` - generate age secret key and store it in the cloud

#### Build commands

- `make build` - build all
- `make build-lambdas` - build lambdas
- `make build-infra` - build infra deployer container image
- `make clean` - remove compiled lambdas and decrypted secrets
- `make clean-secrets` - remove decrypted secrets file
- `make clean-lambdas` - remove compiled lambdas

#### Secrets commands

- `make sops-edit-(config|secrets)` - edit encrypted secrets file or create new one
- `make sops-decrypts-(config|secrets)` - decrypt secrets into plan text file
- `make sops-encrypt-(config|secrets)` - encrypt secrets from plan text file
- `make secrets-aws-update` - set secrets in aws from decrypted secrets
- `make secrets-aws-delete regcode=euc1` - delete secrets in aws

#### Cdk commands

Cdk commands support additional arguments: `app`, `stage` and `regcode`. Their defaults are set in `Makefile` and equal to `make app=deployer-glb stage=dev regcode='*'`.

list:

- `make ls` - list infra stacks for given region
- `make lsa` - list infra stacks for all regions
- `make lsa-all` - list all stacks for all apps
- `make metadata` - show stacks metadata

diff:

- `make diff` - diff infra changes
- `make diff-all` - diff infra changes for all apps

deploy:

- `make deploy` - deploy infra & lambdas
- `make deploy-all` - deploy infra & lambdas for all apps

outputs:

- `make outputs` - display stack outputs
- `make outputs-all` - display stack outputs from all apps for given region

destroy:

- `make destroy` - destroy stacks
- `make destroy-all` - destroy stacks from all apps

## Applications

System apps:

- `deployer-glb` - apps deployer (single-region)
- `monitor-glb` - monitor app (single-region)
- `monitor` - monitor app (multi-region)

User apps:

- `be` - backend api app (multi-region)
- `fe` - frontend app (single-region)

## Environments

Stages and their environment configurations are defined under `stages` section in `config.yaml`.

### Deployment

deployer-glb application manages deployments of all other applications including delivering self updates.

![applications deployment](https://user-images.githubusercontent.com/5339042/195422269-3c44f4c6-11b2-4d1f-ab25-40d7243072f6.svg)

### Deployer architecture

Main job of deployer is to run CloudFormation stack updates. It uses CodeBuild to trigger updates and CodePipeline to orchestrate the flow.

![deployer architecture](https://user-images.githubusercontent.com/5339042/195419705-4b1d9b33-441b-41a3-8eda-ee4ba7475634.svg)

1. Upload deployer container image to ECR repo.
2. Upload deployment config to artifacts S3 bucket.
3. Trigger and monitor pipeline execution.
4. Fetch deployment config from artifacts S3 bucket.
5. Trigger CodeBuild RO project to run `make diff` command.
6. Download container image from ECR.
7. Get secret key to decrypt password file.
8. CloudFormation diff.
9. Manual approve step in AWS CodePipeline.
10. Trigger CodeBuild RW project to run `make deploy` command.
11. Get secret key to decrypt password file.
12. Download container image from ECR.
13. CloudFormation deploy.
14. Create/update secrets in SecretsManager.

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
