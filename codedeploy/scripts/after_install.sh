#!/bin/bash
set -e

cd /opt/app || exit 1

#--------------------------------------------------------------
# Build root library (ownd-vci)
#--------------------------------------------------------------
echo "Building root ownd-vci library..."
yarn install
rm -f tsconfig.build.tsbuildinfo
yarn build

#--------------------------------------------------------------
# Build common module
#--------------------------------------------------------------
echo "Building common module..."
cd /opt/app/demos/common
yarn install
rm -f tsconfig.tsbuildinfo
yarn build

#--------------------------------------------------------------
# Build and setup learning-vci
#--------------------------------------------------------------
echo "Building learning-vci..."
cd /opt/app/demos/learning-vci
yarn install
yarn build

#--------------------------------------------------------------
# Get AWS Region from Instance Metadata
#--------------------------------------------------------------
echo "Getting AWS region from instance metadata..."

# Get instance metadata token (IMDSv2)
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")

# Get region from instance metadata
REGION=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/placement/region)

echo "AWS Region: $REGION"

#--------------------------------------------------------------
# Download Certificates from S3
#--------------------------------------------------------------
echo "Downloading certificates from S3..."

# S3 bucket for certificates (set via environment or default)
CERTIFICATES_BUCKET="${CERTIFICATES_BUCKET:-ownd-eujp-experiment-certificates}"
CERTIFICATES_PREFIX="${CERTIFICATES_PREFIX:-issuer}"

# Create certificates directory
mkdir -p /opt/app/demos/learning-vci/certs

# Download certificates from S3
aws s3 cp "s3://${CERTIFICATES_BUCKET}/${CERTIFICATES_PREFIX}/" /opt/app/demos/learning-vci/certs/ \
  --recursive \
  --region "$REGION" || echo "No certificates found in S3 (may be optional)"

# List downloaded certificates
if [ -d /opt/app/demos/learning-vci/certs ]; then
  echo "Certificates directory contents:"
  ls -la /opt/app/demos/learning-vci/certs/
fi

# Set proper ownership and permissions for certificates
chown -R ec2-user:ec2-user /opt/app/demos/learning-vci/certs
chmod 600 /opt/app/demos/learning-vci/certs/*.key 2>/dev/null || true
chmod 600 /opt/app/demos/learning-vci/certs/*.pem 2>/dev/null || true
chmod 644 /opt/app/demos/learning-vci/certs/*.cer 2>/dev/null || true

#--------------------------------------------------------------
# Generate .env from SSM Parameter Store
#--------------------------------------------------------------
echo "Generating .env from SSM Parameter Store..."

# SSM parameter path prefix (set via environment or default)
SSM_PARAMETER_PATH="${SSM_PARAMETER_PATH:-/ownd-eujp/experiment/issuer}"

# Fetch all parameters under the path and generate .env file
aws ssm get-parameters-by-path \
  --path "$SSM_PARAMETER_PATH" \
  --with-decryption \
  --region "$REGION" \
  --query "Parameters[*].[Name,Value]" \
  --output text | while IFS=$'\t' read -r name value; do
    # Extract parameter name (last part of the path)
    key=$(basename "$name")
    # Quote the value to handle spaces and special characters
    echo "${key}=\"${value}\""
done > /opt/app/demos/learning-vci/.env

# Verify .env was created
if [ -s /opt/app/demos/learning-vci/.env ]; then
  echo ".env file generated successfully with $(wc -l < /opt/app/demos/learning-vci/.env) parameters"
else
  echo "Warning: .env file is empty or was not created"
  exit 1
fi

# Set proper ownership
chown -R ec2-user:ec2-user /opt/app
chmod 600 /opt/app/demos/learning-vci/.env

# Create data directory for SQLite
mkdir -p /opt/app/demos/learning-vci/data
chown ec2-user:ec2-user /opt/app/demos/learning-vci/data
