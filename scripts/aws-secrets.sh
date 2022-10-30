#!/usr/bin/env sh

set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
source "${DIR}/functions.sh"

operation=$1
secret_prefix=$2
region=$3
app=$4
secrets_file=$5

if [ $operation = "delete" ]; then
	echo "Deleting secrets with prefix ${secret_prefix} in ${region} region"
	for key in $(aws secretsmanager list-secrets --filters Key=name,Values=${secret_prefix} --query 'SecretList[].Name' --output text); do
		aws secretsmanager delete-secret --region "$region" --secret-id "$key" --force-delete-without-recovery
	done

elif [ $operation = "update" ]; then
	if [ ! -f "$secrets_file" ]; then
		echo "Secrets file does not exists: '$secrets_file'"
		exit
	fi

	secrets="$(yq ".${app}" "$secrets_file")"	

	if [ $secrets = "null" ]; then
		echo "No secrets to create or update for ${app} in ${region}"
		exit
	fi

	echo "Updating secrets for ${app} in ${region}"

	for secret in "$secrets"; do
		key=${secret_prefix}$(echo "$secret" | sed "s/:.*$//")
		value=$(echo "$secret" | sed "s/^.*: //")

		aws secretsmanager create-secret --region "$region" --name "$key" --secret-string "$value" 2>/dev/null \
			|| aws secretsmanager update-secret --region "$region" --secret-id "$key" --secret-string "$value"
	done

else
	echo "Unknown operation: '$operation'"
	exit 1
fi
