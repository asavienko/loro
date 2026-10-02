#!/usr/bin/env bash
# Explicit account/network inputs prevent provisioning into an accidental default.
set -euo pipefail
: "${AWS_REGION:?Set AWS_REGION}"
: "${VPC_ID:?Set VPC_ID}"
: "${SUBNET_ID:?Set SUBNET_ID}"
: "${KEY_NAME:?Set KEY_NAME to an existing EC2 SSH key pair}"
: "${ADMIN_CIDR:?Set ADMIN_CIDR to your public IPv4 address with /32}"
cd "$(dirname "$0")/.."
stack=${STACK_NAME:-loro-api-dev}
# A new image would replace the instance, and its disk holds the database: an existing stack keeps
# the image its instance runs; only a new stack starts from Amazon Linux 2023's latest.
instance=$(aws cloudformation describe-stack-resource --region "$AWS_REGION" --stack-name "$stack" \
  --logical-resource-id Instance --query StackResourceDetail.PhysicalResourceId --output text 2>/dev/null || true)
if [[ -n $instance && $instance != None ]]; then
  ami=$(aws ec2 describe-instances --region "$AWS_REGION" --instance-ids "$instance" \
    --query 'Reservations[0].Instances[0].ImageId' --output text)
else
  ami=$(aws ssm get-parameter --region "$AWS_REGION" \
    --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 \
    --query Parameter.Value --output text)
fi
[[ $ami =~ ^ami-[0-9a-f]+$ ]] || { echo "No image to deploy: $ami" >&2; exit 1; }
aws cloudformation deploy --region "$AWS_REGION" \
  --stack-name "$stack" --template-file infra/ec2/template.yaml \
  --no-fail-on-empty-changeset ${NO_EXECUTE:+--no-execute-changeset} --capabilities CAPABILITY_IAM \
  --parameter-overrides "VpcId=$VPC_ID" "SubnetId=$SUBNET_ID" \
  "KeyName=$KEY_NAME" "AdminCidr=$ADMIN_CIDR" "AmiId=$ami"
aws cloudformation describe-stacks --region "$AWS_REGION" \
  --stack-name "$stack" --query 'Stacks[0].Outputs' --output table
