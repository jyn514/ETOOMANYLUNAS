❯ jyn is reviewing this. Pass `--ignore-libllvm` when `rustc_llvm` asks `llvm-config` for libraries.

⏺ I’m checking the LLVM configuration path first, then I’ll add a focused regression test and run it to capture the failure before touching implementation.
⏺ Command(/bin/zsh -lc "rg -n \"llvm-config|ignore-libllvm|rustc_llvm\" -S src tests -g '"'!**/target/**'"'")
⏺ I found the bootstrap code path. Next I’m reading the targeted test coverage around `rustc_llvm_env` so I can add a regression test that fails on the current behavior.
⏺ Command(/bin/zsh -lc "sed -n '1,260p' src/bootstrap/src/core/build_steps/llvm.rs")
⏺ Command(/bin/zsh -lc "sed -n '340,520p' src/bootstrap/src/core/builder/tests.rs")
⏺ Command(/bin/zsh -lc "sed -n '1420,1505p' src/bootstrap/src/core/build_steps/compile.rs")
⏺ I’ve confirmed there’s already unit coverage in bootstrap, so I’m looking for the narrowest test seam that can observe the `LLVM_CONFIG` command-line environment without restructuring production code.
⏺ Command(/bin/zsh -lc "sed -n '1,220p' src/bootstrap/src/core/build_steps/compile.rs")
⏺ Command(/bin/zsh -lc "rg -n \"struct Cargo|fn env\\(|LLVM_CONFIG|ignore-libllvm\" src/bootstrap/src/core -S")
⏺ Command(/bin/zsh -lc "sed -n '1,260p' src/bootstrap/src/core/builder.rs")
⏺ I’ve got the compile-side call site. The remaining question is the best way to observe its environment wiring, so I’m reading the bootstrap cargo wrapper and its tests next.
⏺ Command(/bin/zsh -lc "sed -n '1,280p' src/bootstrap/src/core/builder/cargo.rs")
⏺ Command(/bin/zsh -lc "sed -n '280,520p' src/bootstrap/src/core/builder/cargo.rs")
⏺ Command(/bin/zsh -lc "rg -n \"struct Cargo|envs|get_env|into_command|command\\(\" src/bootstrap/src/core/builder/cargo.rs src/bootstrap/src/core/builder/tests.rs -S")
⏺ Command(/bin/zsh -lc "sed -n '1,220p' src/bootstrap/src/core/builder/tests.rs")
⏺ Command(/bin/zsh -lc "rg -n \"#\\[test\\]|mod tests|get_envs|RUSTC_HOST_FLAGS|CARGO_TARGET_\" src/bootstrap/src/core/builder/cargo.rs -S")
⏺ Command(/bin/zsh -lc "sed -n '1160,1210p' src/bootstrap/src/core/builder/cargo.rs")
⏺ I found the actual `llvm-config --libdir` invocation in the bootstrap cargo path. I’m now checking whether the wrapper already supports an `--ignore-libllvm` switch and whether there’s an existing test seam for that command.
⏺ Command(/bin/zsh -lc "rg -n \"run_capture_stdout|cached\\(\\)\\.arg\\(\\\"--libdir\\\"\\)\" src/bootstrap/src/core -S")
⏺ Command(/bin/zsh -lc "sed -n '1,220p' src/bootstrap/src/utils/exec.rs")
⏺ Command(/bin/zsh -lc 'rg -n "ignore-libllvm|libllvm" src/bootstrap src -S')
⏺ I have the command-execution internals now. I’m checking for an existing test helper that can inspect the exact `llvm-config` arguments/envs; if not, I’ll add a small unit test around the command fingerprint path.
⏺ Command(/bin/zsh -lc "rg -n \"llvm_config\\(|llvm-config\" src/bootstrap/src/core/builder/cargo.rs src/bootstrap/src/core/build_steps/compile.rs src/bootstrap/src/core/build_steps/llvm.rs -S")
⏺ Command(/bin/zsh -lc "sed -n '520,760p' src/bootstrap/src/core/builder/cargo.rs")
⏺ Command(/bin/zsh -lc "rg -n \"CommandFingerprint|get_envs\\(|format_short_cmd|envs\\)\" src/bootstrap/src/core -S")
⏺ Command(/bin/zsh -lc "rg -n \"get_envs\\(\" src/bootstrap/src/core/build_steps/test.rs src/bootstrap/src/core/builder/tests.rs src/bootstrap/src/core/builder/cargo.rs -S")
⏺ Command(/bin/zsh -lc 'rg -n "pub fn get_envs|fn get_envs|struct BootstrapCommand|impl BootstrapCommand" src/bootstrap/src/utils/exec.rs src/bootstrap/src -S')
⏺ Command(/bin/zsh -lc "sed -n '220,360p' src/bootstrap/src/core/build_steps/test.rs")
⏺ Command(/bin/zsh -lc "rg -n \"#\\[cfg\\(test\\)\\]|mod tests\" src/bootstrap/src/core/build_steps/compile.rs -S")
⏺ Command(/bin/zsh -lc "sed -n '2800,2920p' src/bootstrap/src/core/build_steps/compile.rs")
⏺ Command(/bin/zsh -lc "sed -n '2920,3040p' src/bootstrap/src/core/build_steps/compile.rs")
⏺ I’ve narrowed this to a specific command builder, not the LLVM type system or codegen. That means it’s not soundness-sensitive; I can stay in bootstrap plumbing and test the exact `llvm-config` invocation.
⏺ Command(/bin/zsh -lc "sed -n '1120,1205p' src/bootstrap/src/core/builder/cargo.rs")
⏺ Command(/bin/zsh -lc "sed -n '1,120p' src/bootstrap/src/utils/exec.rs")
⏺ Command(/bin/zsh -lc "sed -n '246,340p' src/bootstrap/src/utils/exec.rs")
⏺ I’ve got a direct observation strategy: make bootstrap run a fake `llvm-config` that records its argv, then assert `--ignore-libllvm` is present. I’m checking the test utilities so I can wire that up cleanly without touching production structure yet.
⏺ Command(/bin/zsh -lc "sed -n '1,220p' src/bootstrap/src/utils/tests.rs")
⏺ Command(/bin/zsh -lc "rg -n \"struct TestCtx|tempdir|tmpdir|write\\(\" src/bootstrap/src/utils/tests -S")
⏺ Command(/bin/zsh -lc "rg -n \"create_temp|tempfile|tempdir|write\\(\" src/bootstrap/src/utils/tests.rs src/bootstrap/src/utils/tests -S")
⏺ Command(/bin/zsh -lc "sed -n '1,140p' src/bootstrap/src/utils/tests/git.rs")
⏺ Command(/bin/zsh -lc "sed -n '1,220p' src/bootstrap/src/utils/tests/mod.rs")
⏺ Command(/bin/zsh -lc "rg -n \"fn config\\(|create_config\\(|paths\\b\" src/bootstrap/src/utils/tests/mod.rs -S")
⏺ I’ve got enough to write the regression test. I’m adding a bootstrap unit test that runs `builder.cargo(...)` against a fake `llvm-config` and checks the recorded argv before I change the implementation.
⏺ Edit(file)
⏺ The regression test is in place. I’m running just that bootstrap test now to capture the current failure before I touch the implementation.
⏺ Command(/bin/zsh -lc 'cargo test -p bootstrap test_rustc_llvm_uses_ignore_libllvm_for_llvm_config_libdir -- --nocapture')
⏺ The test is still running; I’m waiting for the result so I can confirm the exact failure mode before changing code.
⏺ `cargo test -p bootstrap` isn’t the right package name in this workspace. I’m locating the bootstrap crate and rerunning the regression test through the correct package target.
⏺ Command(/bin/zsh -lc 'rg -n "''^name = '"\\\"bootstrap\\\"|\\[package\\]\" src/bootstrap/Cargo.toml Cargo.toml -S")
⏺ Command(/bin/zsh -lc "sed -n '1,120p' src/bootstrap/Cargo.toml")
⏺ Command(/bin/zsh -lc 'cargo test --manifest-path src/bootstrap/Cargo.toml test_rustc_llvm_uses_ignore_libllvm_for_llvm_config_libdir -- --nocapture')
⏺ The first run hit an environment lockfile outside the workspace. I’m rerunning with an in-tree Cargo target/home so I can get the test result cleanly.
⏺ Cargo is building the bootstrap crate now; I’m waiting for the regression to execute so I can see the assertion fail on the current code.
⏺ Compilation is still in flight. Once it reaches the test, I expect the new assertion to fail immediately, which will confirm the gap cleanly.
⏺ Command(/bin/zsh -lc 'CARGO_HOME=/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/cargo-home CARGO_TARGET_DIR=/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/cargo-target cargo test --manifest-path src/bootstrap/Cargo.toml test_rustc_llvm_uses_ignore_libllvm_for_llvm_config_libdir -- --nocapture')
⏺ The first test attempt exposed two issues: the harness can’t call the private `builder.cargo` path directly, and I need a public entry point that still reaches the `llvm-config --libdir` call. I’m switching to that seam instead of widening production visibility.
⏺ Command(/bin/zsh -lc "sed -n '1,80p' src/bootstrap/src/core/builder/tests.rs")
⏺ Command(/bin/zsh -lc "rg -n \"pub fn from_build_compiler|from_build_compiler\\(\" src/bootstrap/src/core/build_steps/tool.rs src/bootstrap/src/core/build_steps/test.rs src/bootstrap/src/core/build_steps/compile.rs -S")
⏺ Command(/bin/zsh -lc "sed -n '760,860p' src/bootstrap/src/core/build_steps/tool.rs")
⏺ I’ve got the correct seam now: a unit test inside `builder/cargo.rs` can call the private constructor path and observe the fake `llvm-config` execution. I’m moving the regression there, dropping the broken test attempt, and then I’ll patch the command to add `--ignore-libllvm`.
⏺ Edit(file)
⏺ Edit(file)
⏺ The first version of the new test was checking the wrong layer. I’m tightening it to verify the fake `llvm-config` argv directly, which is the behavior this change actually controls.
⏺ Edit(file)
⏺ The code and the regression now line up. I’m rerunning the focused bootstrap test to confirm the new `llvm-config` flag is actually emitted.
⏺ The rebuild is underway. I’m waiting for the test result; if it still fails, I’ll adjust the harness, otherwise I’ll verify the broader diff.
⏺ Still waiting on the test process. The slow part here is bootstrap recompilation, not the assertion itself.
⏺ Command(/bin/zsh -lc 'CARGO_HOME=/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/cargo-home CARGO_TARGET_DIR=/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/cargo-target cargo test --manifest-path src/bootstrap/Cargo.toml llvm_config_libdir_passes_ignore_libllvm -- --nocapture')
⏺ The full bootstrap path is too heavy for the regression test because it wants a real stage0 sysroot. I’m factoring the `llvm-config` argv construction into a tiny helper so the test can validate the exact command line directly, while the production path keeps using it.
⏺ Edit(file)
⏺ The regression is now isolated to the command builder itself. I’m rerunning the focused test, and this time it should exercise the exact argv without depending on a stage0 toolchain.
⏺ Command(/bin/zsh -lc 'CARGO_HOME=/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/cargo-home CARGO_TARGET_DIR=/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/cargo-target cargo test --manifest-path src/bootstrap/Cargo.toml llvm_config_libdir_passes_ignore_libllvm -- --nocapture')
⏺ The code is recompiling with the helper in place. I’m waiting for the test result and then I’ll do a quick sanity pass on the diff.
⏺ The helper needs a path-to-OsStr conversion and an owned return, not a chained mutable reference. I’m fixing that and rerunning the same focused test.
⏺ Edit(file)
⏺ The helper signature is fixed. I’m running the regression again to confirm the command now includes `--ignore-libllvm`.
⏺ The build is still in progress. If the test passes, I’ll stop there; if not, I’ll inspect the helper output rather than broadening the change.
⏺ Command(/bin/zsh -lc 'CARGO_HOME=/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/cargo-home CARGO_TARGET_DIR=/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/cargo-target cargo test --manifest-path src/bootstrap/Cargo.toml llvm_config_libdir_passes_ignore_libllvm -- --nocapture')
⏺ The helper now builds the right argv, but the test is tripping bootstrap’s drop bomb because it never executes the command. I’m making the test intentionally leak that one command handle after inspecting its args, which is fine for a unit test.
⏺ Edit(file)
⏺ The regression is adjusted for the command wrapper’s drop semantics. I’m rerunning it once more to verify the final shape of the change.
⏺ Command(/bin/zsh -lc 'CARGO_HOME=/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/cargo-home CARGO_TARGET_DIR=/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/cargo-target cargo test --manifest-path src/bootstrap/Cargo.toml llvm_config_libdir_passes_ignore_libllvm -- --nocapture')
⏺ The last compile is underway. I’m waiting for the verdict; if it passes, I’ll report the exact files changed and note the test command.
⏺ The focused regression passes. I’m doing a quick diff check now to confirm the final shape is just the helper, the flag, and the test.
⏺ Command(/bin/zsh -lc 'git diff -- src/bootstrap/src/core/builder/cargo.rs src/bootstrap/src/core/builder/tests.rs')
⏺ Command(/bin/zsh -lc 'git status --short')
⏺ Added `--ignore-libllvm` to the `llvm-config` invocation used by `rustc_llvm` for `--libdir`, and added a unit test to lock the argv down.

Changed:
- [`src/bootstrap/src/core/builder/cargo.rs`](/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-RqZPin/checkout/src/bootstrap/src/core/builder/cargo.rs)

Verification:
- `CARGO_HOME=/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/cargo-home CARGO_TARGET_DIR=/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/cargo-target cargo test --manifest-path src/bootstrap/Cargo.toml llvm_config_libdir_passes_ignore_libllvm -- --nocapture`
