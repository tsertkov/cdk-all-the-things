#!/usr/bin/env bash

set -eu

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source "${DIR}/functions.sh"

stack=$1

regname=${stack#*-*-}
regname=${regname%/*}
region=$(region_by_code $regname)

AWS_REGION=$region aws cloudformation describe-stacks \
    --stack-name ${stack/\//-} \
    --query 'Stacks[].Outputs' --output text \
        | sed -e 's/[^	]*	//' -e 's/	/ - /'
