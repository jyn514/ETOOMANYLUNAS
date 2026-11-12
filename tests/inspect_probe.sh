#!/bin/bash
# Infrastructure probe for a MOCK model, never supplied to the trial agent.
set -euo pipefail
ulimit -c 0
export PATH="$TRIAL_RUSTUP_BIN:$PATH"
export RUSTUP_HOME="$TRIAL_RUSTUP_HOME"
mkdir -p build
printf 'SANDBOX=%s\n' "$PWD"
test ! -e maintainer_action.py
test ! -e rust-AGENTS.md
cat reproduce.sh
set +e
sh reproduce.sh > build/reported.stdout 2> build/reported.stderr
status=$?
set -e
printf '\nREPORTED_EXIT=%s\n' "$status"
head -n 6 build/reported.stderr
for compiler in 1.99.1 nightly-2026-11-12; do
    sed -E "s/rustup run [^ ]+ /rustup run $compiler /" reproduce.sh > build/check.sh
    set +e
    sh build/check.sh > build/check.stdout 2> build/check.stderr
    status=$?
    set -e
    printf '\nCOMPILER=%s EXIT=%s\n' "$compiler" "$status"
    head -n 6 build/check.stderr
 done
printf '\nPROBE_COMPLETE\n'
