❯ jyn is reviewing this. Pass `--ignore-libllvm` when `rustc_llvm` asks `llvm-config` for libraries.

⏺ I’m checking the existing build/test surface first so I can add a regression test before touching implementation. Then I’ll verify the affected `rustc_llvm` path and make the minimal change.
⏺ Bash(/bin/zsh -lc 'rg -n "llvm-config" src build -S')
⏺ Bash(/bin/zsh -lc 'pwd && rg -n "rustc_llvm|llvm-config|ignore-libllvm" -S .')
⏺ I found the relevant code path in `compiler/rustc_llvm/build.rs`. Next I’m reading the build script and nearby tests to see whether this is already covered by a unit-style test or whether I need to add one in the existing bootstrap test suite.
⏺ Bash(/bin/zsh -lc "sed -n '260,520p' compiler/rustc_llvm/build.rs")
⏺ Bash(/bin/zsh -lc "sed -n '1,260p' compiler/rustc_llvm/build.rs")
⏺ Bash(/bin/zsh -lc "sed -n '360,520p' src/bootstrap/src/core/builder/tests.rs")
⏺ I found there isn’t an existing unit test for this exact command-line construction, so I’m adding a narrow build-script test first. It will fail until I wire the `--ignore-libllvm` flag into the `llvm-config` invocation.
⏺ Edit(file)
⏺ I’ve hit the usual build-script testing awkwardness, so I’m checking whether this repo already has a pattern for exercising `build.rs` logic directly. If not, I’ll need to route through an existing bootstrap test helper instead of inventing a new harness.
⏺ Bash(/bin/zsh -lc "rg -n \"#\\[cfg\\(test\\)\\] mod tests\" compiler/*/build.rs src/bootstrap/src -S")
⏺ Bash(/bin/zsh -lc "rg -n \"build.rs\" compiler -g '*test*' -S")
⏺ Bash(/bin/zsh -lc 'cargo test -p rustc_llvm --lib --no-run')
⏺ The test compile is in flight. If it fails the way I expect, I’ll switch from test discovery to the minimal implementation change and then rerun the same check.
⏺ The failure was the expected one from the missing helper path, not from the flag logic itself. This is not soundness-sensitive; it only changes how `rustc_llvm` queries linker inputs from `llvm-config`.
⏺ Edit(file)
⏺ I’ve wired the flag into the command construction. I’m now exercising the build script with a tiny fake `llvm-config` so the test can actually run through the relevant branch instead of failing on unrelated bootstrap environment requirements.
⏺ Bash(/bin/zsh -lc 'tmpdir=$(mktemp -d)
cat > "$tmpdir/llvm-config" <<'"'EOF'
#"'!/bin/sh
case "$1" in
  --help)
    echo '"'usage: llvm-config [--quote-paths]'
    exit 0
    ;;
  --components)
    echo 'ipo bitreader bitwriter linker asmparser lto coverage instrumentation'
    exit 0
    ;;
  --cxxflags)
    echo '-std=c++17'
    exit 0
    ;;
  --link-static)
    shift
    if [ \""'$1" = "--libs" ]; then
      echo '"'-lLLVMCore'
      exit 0
    fi
    if [ \""'$1" = "--ldflags" ]; then
      echo '"''
      exit 0
    fi
    ;;
esac
echo ''
exit 0
EOF
chmod +x \""'$tmpdir/llvm-config"
REAL_LIBRARY_PATH_VAR=DYLD_LIBRARY_PATH REAL_LIBRARY_PATH= LLVM_CONFIG="$tmpdir/llvm-config" cargo test -p rustc_llvm --lib --no-run')
⏺ The first verification run was blocked by Cargo’s shared cache lock in the home directory, so I’m rerunning with a temporary `CARGO_HOME` to keep the check self-contained.
⏺ Bash(/bin/zsh -lc 'tmpdir=$(mktemp -d)
cat > "$tmpdir/llvm-config" <<'"'EOF'
#"'!/bin/sh
case "$1" in
  --help)
    echo '"'usage: llvm-config [--quote-paths]'
    exit 0
    ;;
  --components)
    echo 'ipo bitreader bitwriter linker asmparser lto coverage instrumentation'
    exit 0
    ;;
  --cxxflags)
    echo '-std=c++17'
    exit 0
    ;;
  --link-static)
    shift
    if [ \""'$1" = "--libs" ]; then
      echo '"'-lLLVMCore'
      exit 0
    fi
    if [ \""'$1" = "--ldflags" ]; then
      echo '"''
      exit 0
    fi
    ;;
esac
echo ''
exit 0
EOF
chmod +x \""'$tmpdir/llvm-config"
CARGO_HOME="$tmpdir/cargo-home" REAL_LIBRARY_PATH_VAR=DYLD_LIBRARY_PATH REAL_LIBRARY_PATH= LLVM_CONFIG="$tmpdir/llvm-config" cargo test -p rustc_llvm --lib --no-run')
⏺ The isolated Cargo run is now past setup and building dependencies. I’m waiting for it to finish so I can confirm the testable change held up end-to-end.
⏺ Cargo is still trying to write into the shared default target cache, so I’m forcing a private target dir as well. That should keep the check fully inside the workspace/tmp area.
⏺ The rerun is proceeding in the private target directory now. If it finishes cleanly, I’ll have a real compile check on the change rather than just a textual patch review.
⏺ Bash(/bin/zsh -lc 'tmpdir=$(mktemp -d)
cat > "$tmpdir/llvm-config" <<'"'EOF'
#"'!/bin/sh
case "$1" in
  --help)
    echo '"'usage: llvm-config [--quote-paths]'
    exit 0
    ;;
  --components)
    echo 'ipo bitreader bitwriter linker asmparser lto coverage instrumentation'
    exit 0
    ;;
  --cxxflags)
    echo '-std=c++17'
    exit 0
    ;;
  --link-static)
    shift
    if [ \""'$1" = "--libs" ]; then
      echo '"'-lLLVMCore'
      exit 0
    fi
    if [ \""'$1" = "--ldflags" ]; then
      echo '"''
      exit 0
    fi
    ;;
esac
echo ''
exit 0
EOF
chmod +x \""'$tmpdir/llvm-config"
CARGO_HOME="$tmpdir/cargo-home" CARGO_TARGET_DIR="$tmpdir/target" REAL_LIBRARY_PATH_VAR=DYLD_LIBRARY_PATH REAL_LIBRARY_PATH= LLVM_CONFIG="$tmpdir/llvm-config" cargo test -p rustc_llvm --lib --no-run')
⏺ The build-script run got far enough to exercise the relevant logic and then failed on the intentionally fake LLVM headers, which is separate from this change. I’m doing a quick source check for formatting and to make sure the helper is placed cleanly.
⏺ Bash(/bin/zsh -lc "sed -n '90,180p' compiler/rustc_llvm/build.rs")
⏺ Bash(/bin/zsh -lc "sed -n '300,360p' compiler/rustc_llvm/build.rs")
⏺ The source shape is right, but I want the formatting aligned before I wrap. I’m running `rustfmt` on the touched file only, not the whole tree.
⏺ Bash(/bin/zsh -lc 'rustfmt compiler/rustc_llvm/build.rs')
⏺ `rustfmt` can’t run on this file with the repo’s current edition settings because the file already uses `let` chains. I’m leaving the existing style intact and doing one last diff sanity check.
⏺ Bash(/bin/zsh -lc 'git diff -- compiler/rustc_llvm/build.rs')
⏺ Bash(/bin/zsh -lc 'git status --short')
⏺ The diff exposed one accidental indentation shift and the test helper call still needs to match the implemented behavior. I’m correcting both now so the file is internally consistent.
⏺ The patch context drifted after the earlier edit. I’m reopening the affected slice and then I’ll apply a precise fix.
⏺ Bash(/bin/zsh -lc "sed -n '420,455p' compiler/rustc_llvm/build.rs")
⏺ Bash(/bin/zsh -lc "sed -n '535,565p' compiler/rustc_llvm/build.rs")
⏺ Edit(file)
⏺ The source is cleaned up now. I’m doing a final diff pass to make sure the only behavioral change is the new `--ignore-libllvm` flag on the `llvm-config --libs` invocation.
⏺ Bash(/bin/zsh -lc 'git diff -- compiler/rustc_llvm/build.rs')
⏺ Implemented in [`compiler/rustc_llvm/build.rs`](/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-ROYEWr/checkout/compiler/rustc_llvm/build.rs).

What changed:
- Added a small helper for the `llvm-config --libs` command.
- Passed `--ignore-libllvm` on that invocation.
- Added a regression test that checks the helper includes the flag.

Verification:
- I ran a targeted `cargo test -p rustc_llvm --lib --no-run` with a fake `llvm-config`.
- That got far enough to exercise the build script path, but the run stopped later because the fake LLVM setup does not provide `llvm/Config/llvm-config.h`. That failure is unrelated to the flag change.

If you want, I can also wire up a more isolated test around the exact argv construction so the regression is observable without needing the C++ compile step.
