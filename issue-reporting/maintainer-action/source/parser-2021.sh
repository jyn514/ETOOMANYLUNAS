#!/bin/sh
set -eu
ulimit -c 0
mkdir -p build
exec rustup run nightly-2026-11-12 rustc --edition 2021 repro.rs --out-dir build
