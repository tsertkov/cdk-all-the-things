#!/usr/bin/env sh

set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
source "${DIR}/functions.sh"

operation=$1
secret_prefix=$2
regcode=$3
app=$4
secrets_file=$5

region=
if [ -z "$regcode" -o "$regcode" != "*" ]; then
    region=$(region_by_code $regcode)
    if [ -z "$region" ]; then
        echo "Unknown region code: '$regcode'"
        exit 1
    fi
fi

key=${secret_prefix}$(echo "$secret" | sed "s/:.*$//")

if [ $operation = "delete" ]; then
	echo "Deleting secrets with prefix ${secret_prefix} in ${region} region"
	aws secretsmanager delete-secret --region "$region" --secret-id "$key" --force-delete-without-recovery

elif [ $operation = "update" ]; then
	echo "Updating secrets for ${app} in ${region} region"

	if [ ! -f "$secrets_file" ]; then
		echo "Secrets file does not exists: '$secrets_file'"
		exit
	fi

	secrets="$(yq ".${app}" "$secrets_file")"

	for secret in "$secrets"; do
		value=$(echo "$secret" | sed "s/^.*: //")

		aws secretsmanager create-secret --region "$region" --name "$key" --secret-string "$value" 2>/dev/null \
			|| aws secretsmanager update-secret --region "$region" --secret-id "$key" --secret-string "$value"

		run_secret_operation "$operation" "$region" "$key" "$value"
	done

else
	echo "Unknown operation: '$operation'"
	exit 1
fi
