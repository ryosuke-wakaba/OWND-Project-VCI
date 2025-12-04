#!/bin/bash
set -e

cd /opt/app/demos/learning-vci || exit 1

# Load environment variables
if [ -f /opt/app/demos/learning-vci/.env ]; then
    set -a
    source /opt/app/demos/learning-vci/.env
    set +a
fi

# Start application with pm2 as ec2-user
sudo -u ec2-user bash -c 'cd /opt/app/demos/learning-vci && pm2 start yarn --name "issuer" -- start'

# Save pm2 process list
sudo -u ec2-user pm2 save

echo "Application started successfully"
