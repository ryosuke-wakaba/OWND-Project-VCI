#!/bin/bash
set -e

cd /opt/app/demos/learning-vci || exit 1

# Start application with pm2 as ec2-user with logs in /var/log/pm2
# Load .env inside ec2-user's shell so environment variables are available to pm2
sudo -u ec2-user bash -c '
  cd /opt/app/demos/learning-vci
  if [ -f /opt/app/demos/learning-vci/.env ]; then
    set -a
    source /opt/app/demos/learning-vci/.env
    set +a
  fi
  pm2 start yarn --name "issuer" --output /var/log/pm2/out.log --error /var/log/pm2/error.log -- start
'

# Save pm2 process list
sudo -u ec2-user pm2 save

echo "Application started successfully"
