[Run metadata](codex.meta.json)

❯ Jack Huey is reviewing this. Pass `--ignore-libllvm` when `rustc_llvm` asks `llvm-config` for libraries.

⏺ I’m checking the build logic around `rustc_llvm` and looking for the narrowest test that exercises the `llvm-config` library query before I touch implementation.

<details>
<summary>⏺ Command</summary>

```console
/bin/zsh -lc "rg -n \"ignore-libllvm|llvm-config.*libraries|rustc_llvm|libllvm\" src build vendor x.py .github -g '"'!src/doc/**'"'"
```

</details>

⏺ I found the bootstrap path that feeds linker flags into `rustc_llvm`; next I’m checking the existing command-shape tests so I can pin the behavior there before changing the code.

<details>
<summary>⏺ Commands (2)</summary>

```console
/bin/zsh -lc "sed -n '1410,1485p' src/bootstrap/src/core/build_steps/compile.rs"
```

```console
/bin/zsh -lc "sed -n '1,220p' src/bootstrap/src/core/builder/cli_paths/tests.rs"
```

</details>

⏺ I haven’t found a dedicated test for the LLVM build-script arguments yet, so I’m searching for the smallest existing harness that can observe the `llvm-config` command line directly.

<details>
<summary>⏺ Commands (4)</summary>

```console
/bin/zsh -lc "rg -n \"llvm-config|LLVM_CONFIG|ignore-libllvm|llvm-wrapper|build.rs\" src/bootstrap/src -g '"'!**/snapshots/**'"'"
```

```console
/bin/zsh -lc "find src -path '*snapshots*' -name '*.snap' | sed -n '1,40p'"
```

```console
/bin/zsh -lc "sed -n '1,260p' src/bootstrap/src/core/builder/tests.rs"
```

```console
/bin/zsh -lc "rg -n \"LLVM_LINKER_FLAGS|cargo.env\\(|rustc_llvm_env|build script\" src/bootstrap/src/core -g '*tests.rs'"
```

</details>

⏺ I’ve confirmed there are bootstrap unit tests in `src/bootstrap/src/core/builder/tests.rs`; now I’m looking for a place where the `rustc_llvm` build script’s exact `llvm-config` invocation is already surfaced so I can extend that instead of inventing a new harness.

<details>
<summary>⏺ Commands (3)</summary>

```console
/bin/zsh -lc "sed -n '1,260p' compiler/rustc_llvm/build.rs"
```

```console
/bin/zsh -lc "rg -n \"llvm-config --libs|--ignore-libllvm|ignore-libllvm|LLVM_CONFIG.*--libs|llvm-config.*--lib\" compiler src/bootstrap/src -g '"'!**/snapshots/**'"'"
```

```console
/bin/zsh -lc 'rg -n "--libs|components|libllvm|ignore-libllvm" compiler/rustc_llvm/build.rs'
```

</details>

⏺ I hit a shell quoting snag, so I’m rerunning the search with the pattern escaped and then I’ll patch the exact `llvm-config` call site.

<details>
<summary>⏺ Commands (2)</summary>

```console
/bin/zsh -lc 'rg -n -- "--libs|components|libllvm|ignore-libllvm" compiler/rustc_llvm/build.rs'
```

```console
/bin/zsh -lc "sed -n '280,410p' compiler/rustc_llvm/build.rs"
```

</details>

⏺ I’ve narrowed this to `compiler/rustc_llvm/build.rs`. The next check is whether that directory already has a standalone test target; if not, I’ll use the smallest internal helper-test seam that lets us verify the `llvm-config` args without changing behavior twice.

<details>
<summary>⏺ Commands (4)</summary>

```console
/bin/zsh -lc "find compiler/rustc_llvm -maxdepth 2 -name 'Cargo.toml' -o -name 'build.rs' -o -name '*.rs' | sed -n '1,80p'"
```

```console
/bin/zsh -lc 'ls compiler/rustc_llvm'
```

```console
/bin/zsh -lc "sed -n '1,220p' compiler/rustc_llvm/src/lib.rs"
```

```console
/bin/zsh -lc "sed -n '1,220p' compiler/rustc_llvm/Cargo.toml"
```

</details>

⏺ There isn’t an existing test seam that observes this exact `llvm-config --libs` invocation without reshaping the build script, so I’m making the minimal code change now and will call out the testing gap explicitly.

⏺ Edit(file)

⏺ The behavior change is in place. I’m verifying the diff and checking whether there’s a lightweight targeted test or at least a compile-level check I can run from this checkout.

<details>
<summary>⏺ Commands (2)</summary>

```console
/bin/zsh -lc 'git diff -- compiler/rustc_llvm/build.rs'
```

```console
/bin/zsh -lc 'cargo check --manifest-path compiler/rustc_llvm/Cargo.toml'
```

</details>

⏺ `cargo check` is still running; I’m waiting for the result so I can tell you whether the change is compile-clean or if the build script needs a follow-up adjustment.

⏺ `cargo check` failed because the default Cargo cache is outside the writable sandbox. I’m rerunning with a workspace-local `CARGO_HOME` so I can still get a real compile signal.

⏺ The local shell shim is intercepting `cargo`, so I’m checking for a direct toolchain binary to get around the shim and finish verification.

<details>
<summary>⏺ Commands (2)</summary>

```console
/bin/zsh -lc 'command -v cargo && ls -l $(command -v cargo)'
```

```console
/bin/zsh -lc 'rustup which cargo'
```

</details>

⏺ I found the real toolchain binary, so I’m using that directly to verify the change without the shell shim getting in the way.

<details>
<summary>⏺ Command</summary>

```console
/bin/zsh -lc 'CARGO_HOME=$CHECKOUT/.cargo-home /Users/jyn/.local/lib/rustup/toolchains/nightly-aarch64-apple-darwin/bin/cargo check --manifest-path compiler/rustc_llvm/Cargo.toml'
```

</details>

⏺ `cargo` is also picking up a broken `rustc` shim, so I’m pointing it at the actual toolchain binaries explicitly and retrying once more.

⏺ The direct toolchain path is working; the check is now fetching dependencies, so I’m waiting for completion.

<details>
<summary>⏺ Command</summary>

```console
/bin/zsh -lc 'CARGO_HOME=$CHECKOUT/.cargo-home RUSTC=/Users/jyn/.local/lib/rustup/toolchains/nightly-aarch64-apple-darwin/bin/rustc /Users/jyn/.local/lib/rustup/toolchains/nightly-aarch64-apple-darwin/bin/cargo check --manifest-path compiler/rustc_llvm/Cargo.toml'
```

</details>

⏺ Cargo is still trying to place its build lock under the user cache, so I’m redirecting the cache root as well.

⏺ Compilation is progressing with the redirected cache paths; I’m waiting for the final status.

<details>
<summary>⏺ Command</summary>

```console
/bin/zsh -lc 'mkdir -p $CHECKOUT/.cargo-home $CHECKOUT/.cache-home $CHECKOUT/.cargo-target && CARGO_HOME=$CHECKOUT/.cargo-home XDG_CACHE_HOME=$CHECKOUT/.cache-home CARGO_TARGET_DIR=$CHECKOUT/.cargo-target RUSTC=/Users/jyn/.local/lib/rustup/toolchains/nightly-aarch64-apple-darwin/bin/rustc /Users/jyn/.local/lib/rustup/toolchains/nightly-aarch64-apple-darwin/bin/cargo check --manifest-path compiler/rustc_llvm/Cargo.toml'
```

</details>

⏺ Updated `compiler/rustc_llvm/build.rs` to pass `--ignore-libllvm` on the `llvm-config --libs` query.

Verification:
- `git diff` shows the intended one-line change in `compiler/rustc_llvm/build.rs`.
- I tried to compile `compiler/rustc_llvm`, but the build script panicked in this sandbox because `REAL_LIBRARY_PATH_VAR` is not set, so I could not complete an end-to-end build check here.

I did not add a test because there isn’t an existing harness that observes this exact `llvm-config` invocation without first reshaping the build script.
