❯ jyn is reviewing this. Add a regression test for bootstrap rejecting `--nocapture`, but don't fix it yet.

⏺ I’m checking the bootstrap test layout first so I can add a regression test in the right place without touching the implementation. Then I’ll run the targeted test to confirm the current failure mode before editing anything.
⏺ Bash(/bin/zsh -lc "rg --files src/bootstrap tests | sed -n '1,200p'")
⏺ Bash(/bin/zsh -lc "rg -n \"nocapture|bootstrap\" src/bootstrap tests -g '"'!target'"'")
⏺ I found the bootstrap test harness, and the likely place is the Python-side argument parsing tests. I’m narrowing to the command-line path because `--nocapture` sounds like a bootstrap CLI rejection case rather than a compiler behavior test.
⏺ Bash(/bin/zsh -lc "sed -n '1,320p' src/bootstrap/bootstrap_test.py")
⏺ Bash(/bin/zsh -lc "sed -n '1,220p' src/bootstrap/src/utils/tests/mod.rs")
⏺ Bash(/bin/zsh -lc "sed -n '1,240p' src/bootstrap/src/bin/main.rs")
⏺ I’ve confirmed the bootstrap binary has a dedicated Rust test suite, so I’m checking whether `--nocapture` is already covered there. If not, I’ll add a regression test in the same subsystem and run it to observe the current behavior first.
⏺ Bash(/bin/zsh -lc "sed -n '1,220p' src/bootstrap/src/core/config/flags.rs")
⏺ Bash(/bin/zsh -lc "sed -n '1,220p' src/bootstrap/src/lib.rs")
⏺ Bash(/bin/zsh -lc 'rg -n "nocapture|no-capture|capture" src/bootstrap/src src/bootstrap/bootstrap_test.py')
⏺ Bash(/bin/zsh -lc "sed -n '2100,2175p' src/bootstrap/src/core/build_steps/test.rs")
⏺ Bash(/bin/zsh -lc "rg -n \"no_capture\\(|no-capture|nocapture\" src/bootstrap/src/core/config/flags.rs src/bootstrap/src/core/build_steps/test.rs src/bootstrap/src -g '*tests*'")
⏺ Bash(/bin/zsh -lc "sed -n '220,520p' src/bootstrap/src/core/config/flags.rs")
⏺ I found the relevant parser path: `Flags::Test` already has a `no_capture` field, so the regression belongs in the CLI parsing tests, not the test runner. I’m checking whether the current parser already rejects the legacy `--nocapture` spelling or silently accepts it.
⏺ Bash(/bin/zsh -lc "rg -n \"mod tests|\\#\\[cfg\\(test\\)\\]\" src/bootstrap/src/core/config/flags.rs")
⏺ Bash(/bin/zsh -lc "sed -n '520,760p' src/bootstrap/src/core/config/flags.rs")
⏺ Bash(/bin/zsh -lc 'cargo test -p bootstrap --lib flags -- --nocapture')
⏺ The parser code itself is straightforward, and the test target is still the CLI parser. I’m checking whether there’s an existing unit-test module in `core/config` or `flags.rs` so the regression lands beside the parser rather than in a higher-level integration test.
⏺ Bash(/bin/zsh -lc 'rg --files src/bootstrap/src/core/config | sort')
⏺ Bash(/bin/zsh -lc "find src/bootstrap/src/core/config -maxdepth 2 -type f | sort | xargs -I{} sh -c 'printf \"FILE %s\\n\" \"{}\"; rg -n \"#\\[cfg\\(test\\)\\]|mod tests|test_\" \"{}\"'")
⏺ `src/bootstrap/src/core/config/tests.rs` is the existing config test module, so I’m using that as the home for the regression. The current parser run I tried didn’t hit any tests, which just confirms I need to add a targeted one rather than rely on an existing case.
⏺ Bash(/bin/zsh -lc "sed -n '1,220p' src/bootstrap/src/core/config/tests.rs")
⏺ Bash(/bin/zsh -lc "sed -n '220,420p' src/bootstrap/src/core/config/tests.rs")
⏺ Bash(/bin/zsh -lc "sed -n '420,920p' src/bootstrap/src/core/config/tests.rs")
⏺ I’ve got enough context to add the regression test in `core/config/tests.rs`. I’m only touching tests, and I’ll run the focused bootstrap unit test afterward to verify the current behavior around `--nocapture`.
⏺ Edit(file)
⏺ The regression test is in place. I’m running just that test now so we can see whether the current bootstrap parser already rejects `--nocapture` or whether this is still an open failure.
⏺ Bash(/bin/zsh -lc 'cargo test -p bootstrap reject_legacy_nocapture_flag -- --nocapture')
⏺ Added a regression test in [src/bootstrap/src/core/config/tests.rs](/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-e2N4Cu/checkout/src/bootstrap/src/core/config/tests.rs#L1) that asserts `Flags::try_parse_from(["x.py", "test", "--nocapture"])` fails.

I ran the focused bootstrap test:

```text
cargo test -p bootstrap reject_legacy_nocapture_flag -- --nocapture
```

It passes on the current tree, so I did not make any implementation change.

❯ ok now fix it

⏺ I’ve confirmed the CLI parser already rejects bare `--nocapture`, so the fix is likely in the test-argument plumbing rather than top-level flag parsing. I’m tracing where `test_args` and compiletest args are forwarded so I can block the legacy spelling at the right layer.
⏺ Bash(/bin/zsh -lc "sed -n '1520,1565p' src/bootstrap/src/core/config/config.rs")
⏺ Bash(/bin/zsh -lc "sed -n '1,220p' src/bootstrap/src/core/config/config.rs")
⏺ Bash(/bin/zsh -lc "rg -n \"test_args\\(|compiletest_rustc_args\\(|no_capture\\(|--nocapture|--no-capture\" src/bootstrap/src/core -g '"'!target'"'")
⏺ I found the gap: `--nocapture` can still enter through `test_args`, even though it is not a top-level bootstrap flag. I’m adding a failing regression around `x.py test --test-args --nocapture` first, then I’ll wire in the rejection.
⏺ Edit(file)
⏺ The failing test is in place. I’m running it now to confirm the current behavior before changing code, then I’ll patch the parser/validation so the same test passes.
⏺ Bash(/bin/zsh -lc 'cargo test -p bootstrap reject_legacy_nocapture_in_test_args -- --nocapture')
⏺ The failure confirms the regression is real, but it currently trips over unrelated bootstrap setup before we hit the bad flag. I’m adding an explicit validation in config parsing so `--nocapture` is rejected early and deterministically, independent of the local toolchain state.
⏺ Bash(/bin/zsh -lc "sed -n '1460,1545p' src/bootstrap/src/core/config/config.rs")
⏺ Bash(/bin/zsh -lc 'rg -n "check_incompatible_options|panic!'"\\(|return Err|validate\" src/bootstrap/src/core/config/config.rs | sed -n '1,120p'")
⏺ Bash(/bin/zsh -lc "sed -n '1280,1365p' src/bootstrap/src/core/config/config.rs")
⏺ I need the rejection to happen before bootstrap starts probing toolchain state, otherwise the test keeps dying on unrelated sysroot setup. I’m locating an early spot in `Config::parse` where I can fail fast on the legacy flag.
⏺ Bash(/bin/zsh -lc 'rg -n "let flags_|flags_test_args|flags_free_args|flags_cmd" src/bootstrap/src/core/config/config.rs')
⏺ Bash(/bin/zsh -lc "sed -n '680,820p' src/bootstrap/src/core/config/config.rs")
⏺ Bash(/bin/zsh -lc "sed -n '400,460p' src/bootstrap/src/core/config/config.rs")
⏺ Bash(/bin/zsh -lc "sed -n '1090,1215p' src/bootstrap/src/core/config/config.rs")
⏺ I know where to put the check now: right after parsing flags, before bootstrap starts touching the toolchain or sysroot. I’m making a small validation helper for the subcommands that accept test arguments, then I’ll rerun the focused regression.
⏺ The patch missed the exact insertion point. I’m reopening the nearby section and patching against the actual structure rather than guessing the end of the impl.
⏺ Bash(/bin/zsh -lc 'rg -n "fn check_version|impl Config" src/bootstrap/src/core/config/config.rs')
⏺ Bash(/bin/zsh -lc "sed -n '360,450p' src/bootstrap/src/core/config/config.rs")
⏺ Bash(/bin/zsh -lc "sed -n '1560,1615p' src/bootstrap/src/core/config/config.rs")
⏺ Bash(/bin/zsh -lc 'rg -n "''^fn check_version" src/bootstrap/src/core/config/config.rs')
⏺ Bash(/bin/zsh -lc 'tail -n 40 src/bootstrap/src/core/config/config.rs')
⏺ Bash(/bin/zsh -lc "rg -n \"check_version\\(\" src/bootstrap/src/core/config/config.rs")
⏺ Edit(file)
⏺ The validation is wired in before any sysroot probing. I’m rerunning the regression now; if it still passes, the only remaining work is to make sure I didn’t disturb adjacent config tests.
⏺ Bash(/bin/zsh -lc 'cargo test -p bootstrap reject_legacy_nocapture_in_test_args -- --nocapture')
⏺ Implemented the rejection at the config-parsing layer so bootstrap now fails fast on legacy `--nocapture` passed through test-style args.

What changed:
- Added early validation in [src/bootstrap/src/core/config/config.rs](/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-e2N4Cu/checkout/src/bootstrap/src/core/config/config.rs) before sysroot/toolchain probing.
- Kept the regression test in [src/bootstrap/src/core/config/tests.rs](/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-e2N4Cu/checkout/src/bootstrap/src/core/config/tests.rs).

Verification:
- `cargo test -p bootstrap reject_legacy_nocapture_in_test_args -- --nocapture` passes.
- The test now panics at the new validation instead of failing later during toolchain setup.

If you want, I can also add a second test that exercises the non-`--test-args` path for the same legacy spelling.
