#!/bin/sh
set -eu
ulimit -c 0
mkdir -p build
exec rustup run 1.99.1 rustc -C target-cpu=znver4 -O -C target-feature=+avx512f repro.rs --out-dir build
