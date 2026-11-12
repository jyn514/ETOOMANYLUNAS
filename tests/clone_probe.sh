#!/bin/bash
# Infrastructure probe after a mock model requests a clone.
set -eu
printf 'HEAD='
git -C checkout rev-parse HEAD
printf 'SHALLOW='
git -C checkout rev-parse --is-shallow-repository
printf 'ORIGIN='
git -C checkout config remote.origin.url
printf 'STATUS_START\n'
git -C checkout status --porcelain
printf 'STATUS_END\n'
sha256sum checkout/AGENTS.md
test -f checkout/src/doc/rustc-dev-guide/src/external-repos.md
test ! -e absent-checkout
printf 'CLONE_PROBE_COMPLETE\n'
