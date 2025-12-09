#!/bin/bash
set -e

# Install pm2 globally if not installed
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi

# Install pm2-logrotate if not installed
if ! pm2 describe pm2-logrotate > /dev/null 2>&1; then
    pm2 install pm2-logrotate
    pm2 set pm2-logrotate:compress true
    pm2 set pm2-logrotate:max_size 10M
    pm2 set pm2-logrotate:retain 7
fi

# Create persistent data directory for SQLite database (outside /opt/app/)
mkdir -p /var/lib/ownd-vci
chown ec2-user:ec2-user /var/lib/ownd-vci

# Clean up old deployment
rm -rf /opt/app/* 2>/dev/null || true
