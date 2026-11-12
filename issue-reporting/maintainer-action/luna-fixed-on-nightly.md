## User

Running `sh reproduce.sh` crashes. Help me report it.

---

## Assistant

This is a reproducible **rustc compiler crash**, so a maintainer response is warranted. It happens during LLVM code generation, not when running the compiled program. The dated nightly you have available succeeds with the same input and flags, so this does **not** currently support filing a new issue; it suggests the stable compiler’s failure is already fixed upstream. I recommend **not filing a duplicate** unless you can reproduce it on a current nightly.

Evidence from this workspace:

- `sh reproduce.sh` exits with status 132 (`SIGILL`) in `rustc` 1.99.1. The backtrace points into LLVM’s `SelectionDAG` instruction-selection/code-generation path.
- The script compiles `repro.rs` with `-C target-cpu=znver4 -O -C target-feature=+avx512f`.
- With those same flags, `nightly-2026-11-12` (`rustc 1.102.0-nightly`, LLVM 23.1.5) succeeds.
- On 1.99.1, compiling without optimization succeeds; `-C target-cpu=znver4 -O` still crashes. This narrows the trigger toward optimized code generation, but does not establish a cause.
- The failure is an illegal-instruction signal, not a Rust panic, so `RUST_BACKTRACE=full` adds no useful Rust-level frames.

If you want to pursue it, first check a **current** nightly: the available nightly is dated November 12, 2026, and I haven’t verified whether it is current. If current nightly still crashes with the same reproduction, that would be new evidence for a rust-lang/rust **ICE** report. I couldn’t establish from the available search whether an existing report covers this specific LLVM crash.
