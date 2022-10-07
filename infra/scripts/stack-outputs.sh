#!/usr/bin/env bash

set -eu

stack=$1

region_by_regname () {
    case $1 in
        euc1)
            echo eu-central-1 ;;
        use1)
            echo us-east-1 ;;
    esac
}

regname=${stack#*-*-}
regname=${regname%/*}
region=$(region_by_regname $regname)

AWS_REGION=$region aws cloudformation describe-stacks \
    --stack-name ${stack/\//-} \
    --query 'Stacks[].Outputs' --output text \
        | sed -e 's/[^	]*	//' -e 's/	/ - /'
