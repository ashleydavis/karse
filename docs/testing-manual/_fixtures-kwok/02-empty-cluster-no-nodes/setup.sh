#!/usr/bin/env bash
set -euo pipefail

kwokctl create cluster --name karse-test --runtime binary --wait 60s

echo "Cluster ready. Select the 'kwok-karse-test' context in Karse."
