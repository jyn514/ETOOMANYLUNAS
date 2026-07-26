❯ Esteban is reviewing this. Pass `--ignore-libllvm` when `rustc_llvm` asks `llvm-config` for libraries.

⏺ Bash({"command":"find . -path ./src/tools -prune -o -iname \"build.rs\" -print | xargs grep -l \"llvm-config\\|llvm_config\" 2>/dev/null"})
⏺ Bash({"command":"grep -n \"libnames\\|libs\\|--libnames\\|ignore-libllvm\\|fn output\\|fn main\\|llvm_config\" ./compiler/rustc_llvm/build.rs | head -80"})
⏺ Read({"file_path":"/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-LPsFju/checkout/compiler/rustc_llvm/build.rs","offset":300,"limit":140})
⏺ Bash({"command":"grep -rn \"ignore-libllvm\\|ignore_libllvm\" . --include=*.rs --include=*.md 2>/dev/null | grep -v \"^Binary\""})
⏺ Bash({"command":"grep -rln \"ignore-libllvm\" . 2>/dev/null; echo \"---\"; grep -rln \"detect_llvm_link\\|rustc_llvm/build\" src/bootstrap tests 2>/dev/null | head -30"})
⏺ Bash({"command":"grep -rln \"llvm-config\" src/bootstrap/src 2>/dev/null; echo \"---mocks---\"; find . -iname \"*mock*llvm*\" -o -iname \"*llvm*mock*\" 2>/dev/null | grep -v \"^./src/tools\""})
⏺ No mock/test harness exists for `rustc_llvm/build.rs`'s invocation of `llvm-config` — nothing fakes `llvm-config` output to observe which flags get passed to it. `compiler/rustc_llvm/build.rs` has no test suite at all; it only runs against a real `llvm-config` during an actual build.

Per the Testing gate in CLAUDE.md: this requires either designing a new test suite (which is itself test-suite design — a PAUSE point, since it'd mean introducing a fake `llvm-config`/dependency-injection boundary) or abandoning the change as untested.

**I need you to choose:** do you want to design a test suite for this (e.g., a fake `llvm-config` script the build script could be pointed at), or should this change be abandoned as untested? I can't proceed with the one-line `--ignore-libllvm` edit until that's decided — writing it untested isn't an option under the policy.
