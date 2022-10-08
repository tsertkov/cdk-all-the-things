#!/usr/bin/env sh

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source "${DIR}/functions.sh"

operation=$1
stage=$2
app=$3
regcode=$4
region=

echo $operation secrets for $stage-$app

project="$(yq ".common.project" config.yaml)"
regions="$(yq ".${app}.stages.${stage}.regions // .${app}.common.regions" config.yaml | sed "s/- //")"
secrets="$(yq ".${app}.stages.${stage}.secrets // .${app}.common.secrets" secrets.yaml)"

if [ "$secrets" = "null" ]; then
    echo "No secrets found for ${project}-${stage}-${app}"
    exit
fi

run_secret_operation () {
    operation=$1
    region=$2
    key=$3
    value=$4

    if [ "$operation" = "delete" ]; then
        aws secretsmanager delete-secret --region "$region" --secret-id "$key" --force-delete-without-recovery
    elif [ "$operation" = "update" ]; then
        aws secretsmanager create-secret --region "$region" --name "$key" --secret-string "$value" 2>/dev/null \
            || aws secretsmanager update-secret --region "$region" --secret-id "$key" --secret-string "$value"
    else
        echo "Unsupported operation: $operation"
        exit 1
    fi
}

if [ -z "$regcode" -o "$regcode" != "*" ]; then
    region=$(region_by_code $regcode)
    if [ -z "$region" ]; then
        echo "Unknown region code: '$regcode'"
        exit 1
    fi
fi

for secret in "$secrets"; do
    key=${project}/${stage}/${app}/$(echo "$secret" | sed "s/:.*$//")
    value=$(echo "$secret" | sed "s/^.*: //")

    if [ -z "$region" ]; then
        for region in $regions; do
            run_secret_operation "$operation" "$region" "$key" "$value"
        done
    else
        run_secret_operation "$operation" "$region" "$key" "$value"
    fi
done
