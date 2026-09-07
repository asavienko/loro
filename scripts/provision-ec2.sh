#!/usr/bin/env bash
# Explicit account/network inputs prevent provisioning into an accidental default.
set -euo pipefail
: "${AWS_REGION:?Set AWS_REGION}"
: "${VPC_ID:?Set VPC_ID}"
: "${SUBNET_ID:?Set SUBNET_ID}"
: "${KEY_NAME:?Set KEY_NAME to an existing EC2 SSH key pair}"
: "${ADMIN_CIDR:?Set ADMIN_CIDR to your public IPv4 address with /32}"
cd "$(dirname "$0")/.."
aws cloudformation deploy --region "$AWS_REGION" \
  --stack-name "${STACK_NAME:-loro-api-dev}" --template-file infra/ec2/template.yaml \
  --no-fail-on-empty-changeset \
  --parameter-overrides "VpcId=$VPC_ID" "SubnetId=$SUBNET_ID" \
  "KeyName=$KEY_NAME" "AdminCidr=$ADMIN_CIDR"
aws cloudformation describe-stacks --region "$AWS_REGION" \
  --stack-name "${STACK_NAME:-loro-api-dev}" --query 'Stacks[0].Outputs' --output table
