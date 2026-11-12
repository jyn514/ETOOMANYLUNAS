# Issue 165741: illegal instruction compiling with AVX-512 enabled

State: closed

[Source](repro.rs)

Command:

```sh
rustc -C target-cpu=znver4 -O -C target-feature=+avx512f repro.rs
```

Reported with rustc 1.99.1: compilation terminates with SIGILL.
[Compiler output excerpt](stderr.txt)

Maintainer response, November 10, 2026:

> This is already fixed in beta, so nothing to do here.

Snapshot verification, November 12, 2026: the source and flags above compile successfully on nightly-2026-11-12, rustc 1.102.0-nightly (3ef0c22cd 2026-11-11).
