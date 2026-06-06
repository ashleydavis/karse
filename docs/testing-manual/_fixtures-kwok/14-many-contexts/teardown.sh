#!/usr/bin/env bash
set -euo pipefail
for i in $(seq 1 5); do
    kwokctl delete cluster --name "karse-test-$i"
done
