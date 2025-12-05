#!/bin/bash

# Stop application gracefully
if sudo -u ec2-user pm2 list | grep -q "issuer"; then
    sudo -u ec2-user pm2 stop issuer || true
    sudo -u ec2-user pm2 delete issuer || true
fi

echo "Application stopped"
