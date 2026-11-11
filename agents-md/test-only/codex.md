[Fixture](scenario.json) · [Setup patch](setup.patch) · [Run metadata](codex.meta.json)

❯ Jack Huey is reviewing this. Add a regression test for bootstrap rejecting `--nocapture`, but don't fix it yet.

⏺ I’m checking the bootstrap test coverage first so I can add a regression test that fails before any implementation change. Then I’ll run just that test to confirm the rejection of `--nocapture` is observable in the existing suite.

<details>
<summary>⏺ Commands (2)</summary>

```console
/bin/zsh -lc "rg --files tests src | rg \"bootstrap|x\\.py|bootstrap.*rs|bootstrap.*py|tidy\""
```

```console
/bin/zsh -lc "rg -n \"nocapture|bootstrap\" tests src -g '"'!src/llvm-project/**'"'"
```

</details>

⏺ I found the bootstrap CLI path tests and am narrowing to the place that exercises accepted/rejected command-line arguments. Next I’m reading the existing test helpers and snapshots so I can add only a regression test, not an implementation change.

<details>
<summary>⏺ Commands (6)</summary>

```console
/bin/zsh -lc "sed -n '1,260p' src/bootstrap/src/utils/tests/mod.rs"
```

```console
/bin/zsh -lc "sed -n '1,240p' src/bootstrap/src/core/builder/cli_paths/tests.rs"
```

```console
/bin/zsh -lc "sed -n '1,220p' src/bootstrap/bootstrap_test.py"
```

```console
/bin/zsh -lc "sed -n '1,240p' src/bootstrap/src/core/builder/mod.rs"
```

```console
/bin/zsh -lc 'rg -n "nocapture|no-capture|unrecognized|recognized|unknown flag|Option .*not recognized|error" src/bootstrap/src/core src/bootstrap/src/bin src/bootstrap/bootstrap_test.py'
```

```console
/bin/zsh -lc "sed -n '1,240p' src/bootstrap/src/lib.rs"
```

</details>

⏺ I found the likely source of the behavior: bootstrap’s flag parser currently aliases `--nocapture` to the newer test-capture flag. I’m checking that code path now so I can add a regression test that exercises the current acceptance and then fails once the behavior is changed.

<details>
<summary>⏺ Commands (3)</summary>

```console
/bin/zsh -lc "sed -n '390,470p' src/bootstrap/src/core/config/flags.rs"
```

```console
/bin/zsh -lc "sed -n '1,220p' src/bootstrap/src/core/config/flags.rs"
```

```console
/bin/zsh -lc "sed -n '1,220p' src/bootstrap/src/core/config/tests.rs"
```

</details>

⏺ I’ve confirmed the parser currently accepts `--nocapture` via an alias, so the regression test will intentionally fail until the implementation is changed. I’m adding a focused unit test in the bootstrap flag parser tests and leaving the production code untouched.

⏺ Edit(file)

⏺ The test is in place. I’m now running the narrowest bootstrap test command I can so we can observe the expected failure before any implementation work.

<details>
<summary>⏺ Commands (2)</summary>

```console
/bin/zsh -lc 'rg -n "x test bootstrap|cargo test.*bootstrap|unit tests" src/bootstrap/README.md src/doc/rustc-dev-guide/src/tests/running.md src/doc/rustc-dev-guide/src/building/how-to-build-and-run.md'
```

```console
/bin/zsh -lc "sed -n '1,220p' src/bootstrap/README.md"
```

</details>

⏺ The focused test run is in progress. I’m waiting for the command to finish so I can confirm the current behavior is still accepted and the new test fails for the intended reason.

<details>
<summary>⏺ Command</summary>

```console
/bin/zsh -lc './x test bootstrap --test-args rejects_nocapture_flag'
```

</details>

⏺ The first run was blocked by Cargo trying to unpack crates into a non-writable home directory, so I’m rerunning with a local `CARGO_HOME` under the workspace. That should let the test compile and expose the actual assertion failure.

⏺ The rerun is still compiling bootstrap. I’m waiting it out because I need the actual test result, not just the compile step, before I can hand this back cleanly.

⏺ Added a regression test in src/bootstrap/src/core/config/tests.rs that asserts `Flags::try_parse_from(["x", "test", "--nocapture"])` returns an error.

I did not change bootstrap itself.

I attempted to run the focused bootstrap test, but the first run was blocked by Cargo trying to write into a non-writable home directory, and the rerun with a local `CARGO_HOME` was still in the bootstrap build step when I stopped. So the new test is in place, but I did not get a completed failure output from the test runner yet.

If you want, I can keep going and try to get the focused test to completion.


❯ ok now fix it

⏺ I’m rerunning the focused bootstrap test with the local cargo cache wired up so I can observe the current failure, then I’ll change the parser and verify the same test passes.

⏺ The build is still running. I’m waiting for the test process to finish so I can use the observed result as the baseline before editing code.

⏺ I haven’t hit the assertion yet; bootstrap is still building. I’m letting it continue because I need the real test outcome before touching the implementation.

⏺ I’m checking whether the command is still making forward progress or just compiling in the background. If it’s genuinely stuck, I’ll switch to a narrower direct test invocation.

⏺ The bootstrap wrapper path is too expensive to wait on blindly here, so I’m switching to the package-level unit test target to observe the regression faster. That still exercises the same parser code and will tell us whether the current behavior needs changing.

<details>
<summary>⏺ Command</summary>

```console
/bin/zsh -lc 'CARGO_HOME=/private/tmp/cargo-home cargo test -p bootstrap rejects_nocapture_flag --lib -- --exact'
```

</details>

⏺ The regression test exposed a compile issue in the test itself: `try_parse_from` needs the `clap::Parser` trait in scope. I’m fixing only the test harness call site, then I’ll rerun the focused test and make the actual parser change after that.

⏺ Edit(file)

⏺ The test now compiles. I’m rerunning the same focused test so we can observe the intended failure before I change the parser behavior.

<details>
<summary>⏺ Command</summary>

```console
/bin/zsh -lc 'CARGO_HOME=/private/tmp/cargo-home cargo test -p bootstrap rejects_nocapture_flag --lib -- --exact'
```

</details>

⏺ The focused filter missed the test name, so I’m listing the bootstrap unit tests to get the exact path. Once I have that, I’ll rerun the failing case and then patch the parser.

<details>
<summary>⏺ Commands (2)</summary>

```console
/bin/zsh -lc 'CARGO_HOME=/private/tmp/cargo-home cargo test -p bootstrap --lib -- --list | rg "rejects|nocapture|clap_verify"'
```

```console
/bin/zsh -lc 'CARGO_HOME=/private/tmp/cargo-home cargo test -p bootstrap core::config::tests::rejects_nocapture_flag --lib -- --exact'
```

</details>

⏺ The failure is confirmed. I’m removing the `--nocapture` alias from the bootstrap test flag parser so the new regression test will pass, and then I’ll rerun that exact test.

⏺ Edit(file)

<details>
<summary>⏺ Command</summary>

```console
/bin/zsh -lc 'CARGO_HOME=/private/tmp/cargo-home cargo test -p bootstrap core::config::tests::rejects_nocapture_flag --lib -- --exact'
```

</details>

⏺ Changed bootstrap so `--nocapture` is no longer accepted as an alias for `--no-capture`, and kept the regression test in place.

What changed:
- Added a unit test in src/bootstrap/src/core/config/tests.rs asserting `--nocapture` is rejected.
- Removed the `alias = "nocapture"` from src/bootstrap/src/core/config/flags.rs.

Verification:
- `cargo test -p bootstrap core::config::tests::rejects_nocapture_flag --lib -- --exact` passed.

If you want, I can also run the broader `x test bootstrap` path for extra confidence.
