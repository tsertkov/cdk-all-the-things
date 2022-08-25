# Infra bootstrap

- cdk bootstrap for target regions
- provision github-oidc cfn stack

  ```
  aws cloudformation create-stack \
    --stack-name 'github-oidc' \
    --template-body file://github-oidc.cfn.yaml`
  ```

- generate age key with `age-keygen -o key.txt` and save its value to aws secretsmanager under `${project}/deployer/age-key` name

  ```
  age-keygen -o key.txt
  aws secretsmanager put-secret-value \
    --name ${project}/deployer/age-key \
    --secret-string $(cat key.txt)
  ```

- run `make sops` to edit new secret config
