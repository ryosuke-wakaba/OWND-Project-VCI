#!/bin/bash

# Stop all pm2 processes gracefully
sudo -u ec2-user pm2 delete all || true

echo "Application stopped"
