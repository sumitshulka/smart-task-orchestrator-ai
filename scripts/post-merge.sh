#!/bin/bash
set -e

# Post-merge setup script
# Runs automatically after every task merge.
# Must be idempotent and non-interactive (stdin is closed).

echo "==> Installing dependencies..."
npm install --prefer-offline 2>&1

echo "==> Post-merge setup complete."
