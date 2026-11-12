# Issue 165690: ICE calling Result::unwrap in the parser

State: open

[Source](repro.rs)

Command: `rustc --edition 2024 repro.rs`

Observed with nightly-2026-11-12, rustc 1.102.0-nightly (3ef0c22cd 2026-11-11): exit 101.

[Compiler output excerpt](stderr.txt)
