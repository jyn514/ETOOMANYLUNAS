❯ jyn is reviewing this. Add a regression test for bootstrap rejecting `--nocapture`, but don't fix it yet.

⏺ I’m checking the bootstrap test surface first so I can add a regression test only, without touching implementation. I’ll verify the relevant harness and find the narrowest existing test that observes `--nocapture` rejection.
⏺ Command(/bin/zsh -lc 'rg -n "External repositories|Prohibited text|Reviewer|Soundness" AGENTS.md CONTRIBUTING.md src/doc/rustc-dev-guide/src/external-repos.md')
⏺ I’ve confirmed the repo gates and the reviewer requirement is satisfied by `jyn`. Next I’m narrowing to the bootstrap CLI tests so the regression lands in an existing harness and stays test-only.
⏺ Command(/bin/zsh -lc "rg -n \"bootstrap.*test|tests.*bootstrap|cli.*bootstrap|arg|clap|structopt\" src/bootstrap/src -g '"'!**/target/**'"'")
⏺ Command(/bin/zsh -lc "pwd && rg -n \"nocapture|bootstrap\" src bootstrap tests -g '"'!**/target/**'"'")
⏺ Command(/bin/zsh -lc "rg -n \"no-capture|nocapture|--nocapture|reject.*capture|unrecognized.*capture|invalid.*capture\" src/bootstrap tests src -g '"'!**/target/**'"'")
⏺ I found the relevant parser: bootstrap already has a clap alias for `nocapture`, which means the regression should live in the CLI/config tests and assert the old spelling is rejected. I’m reading the existing tests around `src/bootstrap/src/core/config/flags.rs` now.
⏺ Command(/bin/zsh -lc "sed -n '1,220p' src/bootstrap/src/utils/tests/mod.rs")
⏺ Command(/bin/zsh -lc "sed -n '380,470p' src/bootstrap/src/core/config/flags.rs")
⏺ Command(/bin/zsh -lc "sed -n '1,220p' src/bootstrap/src/utils/helpers/tests.rs")
⏺ Command(/bin/zsh -lc "sed -n '1,220p' src/bootstrap/src/core/config/flags.rs")
⏺ Command(/bin/zsh -lc "rg -n \"mod tests|\\#\\[test\\]\" src/bootstrap/src/core/config/flags.rs src/bootstrap/src/core/config -g '"'!**/target/**'"'")
⏺ Command(/bin/zsh -lc "sed -n '140,260p' src/bootstrap/src/core/config/tests.rs")
⏺ Command(/bin/zsh -lc "sed -n '1,140p' src/bootstrap/src/core/config/tests.rs")
⏺ Command(/bin/zsh -lc "sed -n '260,380p' src/bootstrap/src/core/config/tests.rs")
⏺ I’ve got the test file. There’s already a `clap_verify` test, so I can add a focused parser test alongside it that asserts the deprecated spelling errors out, without changing runtime behavior.
⏺ Command(/bin/zsh -lc "rg -n \"try_parse_from\\(|ErrorKind::|assert.*contains\\(.*nocapture|should_panic.*clap|clap::Error\" src/bootstrap/src/core/config/tests.rs src/bootstrap/src -g '"'!**/target/**'"'")
⏺ Command(/bin/zsh -lc "rg -n \"no-capture|nocapture\" src/bootstrap/src/core/config/tests.rs src/bootstrap/src/utils/tests/mod.rs src/bootstrap/src -g '"'!**/target/**'"' | head -n 60")
⏺ Command(/bin/zsh -lc 'tail -n 80 src/bootstrap/src/core/config/flags.rs')
⏺ Command(/bin/zsh -lc "sed -n '1,80p' src/bootstrap/src/core/config/mod.rs")
⏺ I’ve got a clean observation point: `Flags::try_parse_from` in the config tests. I’m adding one regression test there so we observe the parser rejecting the legacy spelling before any implementation change.
⏺ Edit(file)
⏺ The regression is in place. I’m running the narrowest bootstrap unit test target next to confirm it fails for the expected reason before any fix work.
⏺ Command(/bin/zsh -lc "rg -n '"'^name'"\\s*=\\s*\"' src/bootstrap/Cargo.toml")
⏺ Command(/bin/zsh -lc 'rg -n "bootstrap.*unit|x test bootstrap|src/bootstrap" src/doc/rustc-dev-guide/src/tests/running.md src/doc/rustc-dev-guide/src/building/how-to-build-and-run.md')
⏺ Command(/bin/zsh -lc "rg -n \"x\\.py test bootstrap|test bootstrap\" src/doc/rustc-dev-guide/src src/bootstrap -g '"'!**/target/**'"'")
⏺ Command(/bin/zsh -lc 'ls src/bootstrap')
⏺ I found the dedicated bootstrap test target. I’m using `x test bootstrap` with a test filter so we get the real bootstrap harness failure, not a generic unit-test run.
⏺ The test run is still in flight while bootstrap primes its stage0 toolchain. I’m waiting for the command to finish so the regression failure is observed before I stop.
⏺ Bootstrap is still compiling the test binary. Once it exits I’ll have the observed failure state, and then I’ll stop without touching implementation.
⏺ The harness has moved past compilation and is now running the bootstrap test pipeline. I’m still waiting for the command to terminate so I can report the actual regression failure, not a speculative one.
⏺ The run is still active; I haven’t seen the test result yet. I’m keeping it open until bootstrap finishes or reports the first failure.
⏺ The environment date shifted while the test was running; I’m ignoring that and continuing with the same observed run. I still haven’t reached the test result, so I’m waiting for the command to exit before stopping.
⏺ Command(/bin/zsh -lc 'python x.py test bootstrap --test-args reject_nocapture_alias')
⏺ Added a regression test in [src/bootstrap/src/core/config/tests.rs](/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-lIhZzp/checkout/src/bootstrap/src/core/config/tests.rs#L66) that exercises `Flags::try_parse_from(["x", "test", "--nocapture"])` and expects an `UnknownArgument` error.

I ran `python x.py test bootstrap --test-args reject_nocapture_alias`, and it currently fails as expected because bootstrap still accepts `--nocapture`:
- `core::config::tests::reject_nocapture_alias` panicked
- observed parsed flags showed `no_capture: true`

I stopped there and did not change implementation.

❯ ok now fix it

⏺ I’m removing the legacy alias from bootstrap’s CLI parser, then I’ll rerun the same regression test to confirm the rejection now happens at parse time.
⏺ Edit(file)
⏺ The parser change is in place. I’m rerunning the same focused bootstrap test so we verify the old spelling is now rejected and the new behavior is stable.
⏺ The rebuild is short this time because only the parser changed. I’m waiting for the test result before I wrap up.
⏺ The test binary is still finishing up. I’m staying with the same targeted run until it exits so I can confirm the regression passes, not just rebuild cleanly.
⏺ The run is still active. No new action needed yet; I’m waiting for the test harness to finish and report the final status.
⏺ Command(/bin/zsh -lc 'python x.py test bootstrap --test-args reject_nocapture_alias')
⏺ Removed the `nocapture` alias from bootstrap’s test CLI in [src/bootstrap/src/core/config/flags.rs](/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-lIhZzp/checkout/src/bootstrap/src/core/config/flags.rs#L425), so `--nocapture` is now rejected instead of accepted.

The regression test in [src/bootstrap/src/core/config/tests.rs](/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-lIhZzp/checkout/src/bootstrap/src/core/config/tests.rs#L66) now passes.

Verification:
- `python x.py test bootstrap --test-args reject_nocapture_alias` passed.
