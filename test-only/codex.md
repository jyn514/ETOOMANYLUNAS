❯ jyn is reviewing this. Add a regression test for bootstrap rejecting `--nocapture`, but don't fix it yet.

⏺ I’m checking the bootstrap test surface first, then I’ll add a regression test that fails on the current behavior without touching the implementation.
⏺ Bash(/bin/zsh -lc "rg --files src test tests | rg \"bootstrap|x\\.py|bootstrap\\.rs|build.*test|run.*bootstrap\"")
⏺ Bash(/bin/zsh -lc "pwd && rg -n \"nocapture|bootstrap\" tests src -g '*.*'")
⏺ I found the bootstrap CLI-path tests and the compiletest `--nocapture` handling. Next I’m narrowing to the exact bootstrap entrypoint test so I can add a regression case in the right place and run it before any code changes.
⏺ Bash(/bin/zsh -lc "sed -n '1,260p' src/bootstrap/src/core/builder/cli_paths/tests.rs")
⏺ Bash(/bin/zsh -lc "sed -n '1,220p' src/bootstrap/bootstrap_test.py")
⏺ Bash(/bin/zsh -lc "sed -n '1,220p' src/bootstrap/src/lib.rs")
⏺ The current behavior appears to live in `src/bootstrap/bootstrap.py`, so I’m checking the Python test harness first. If there’s already a parser/dispatcher path for this flag, I can add a focused regression test without changing that code.
⏺ Bash(/bin/zsh -lc 'rg -n "nocapture|no-capture|capture" src/bootstrap/bootstrap.py src/bootstrap/configure.py src/bootstrap/bootstrap_test.py')
⏺ Bash(/bin/zsh -lc "sed -n '220,520p' src/bootstrap/bootstrap_test.py")
⏺ Bash(/bin/zsh -lc 'rg -n "nocapture|no-capture|warnings|parse_args|build_bootstrap_cmd" src/bootstrap/bootstrap.py')
⏺ Bash(/bin/zsh -lc "sed -n '1,240p' src/bootstrap/bootstrap.py")
⏺ Bash(/bin/zsh -lc "sed -n '1240,1315p' src/bootstrap/bootstrap.py")
⏺ Bash(/bin/zsh -lc "sed -n '1030,1185p' src/bootstrap/bootstrap.py")
⏺ I confirmed `bootstrap.parse_args` currently accepts unknown flags via `parse_known_args`, so a regression test can assert that `--nocapture` is rejected and will fail today. I’m going to exercise that behavior directly once before editing so the initial failure is observed.
⏺ Bash(/bin/zsh -lc "python - <<'PY'
import sys
sys.path.insert(0, 'src/bootstrap')
import bootstrap
try:
    bootstrap.parse_args(['--nocapture'])
    print('accepted')
except SystemExit as e:
    print('rejected', e.code)
PY")
⏺ I’ve got the failing behavior pinned down. I’m adding a focused unit test in `src/bootstrap/bootstrap_test.py` that asserts `--nocapture` is rejected by bootstrap’s argument parser, without changing parser behavior.
⏺ Edit(file)
⏺ The regression test is in place. I’m running just that case now; it should fail on the current code, which confirms the test is correctly capturing the bug without a fix.
⏺ Bash(/bin/zsh -lc 'python -m unittest src/bootstrap/bootstrap_test.py ParseArgsInBootstrap.test_reject_nocapture')
⏺ The new test fails as intended: `bootstrap.parse_args(["--nocapture"])` still returns successfully. I also saw unrelated bootstrap-test setup errors from missing local Cargo in this environment, so I’m rerunning only the new parser test with the correct unittest target to keep the signal clean.
⏺ Bash(/bin/zsh -lc 'python -m unittest src.bootstrap.bootstrap_test.ParseArgsInBootstrap.test_reject_nocapture')
⏺ Added a regression test in [src/bootstrap/bootstrap_test.py](/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-vdKMhl/checkout/src/bootstrap/bootstrap_test.py#L257) that asserts `bootstrap.parse_args(["--nocapture"])` raises `SystemExit`.

I ran the new test directly:

```text
python -m unittest src.bootstrap.bootstrap_test.ParseArgsInBootstrap.test_reject_nocapture
```

It fails now with `AssertionError: SystemExit not raised`, which is the expected pre-fix state. I did not change the implementation.

❯ ok now fix it

⏺ I’m changing the Python bootstrap argument parser so `--nocapture` is rejected explicitly, while leaving other unknown bootstrap-side flags alone. Then I’ll rerun the focused regression test.
⏺ Bash(/bin/zsh -lc "rg -n \"no-capture|nocapture\" src/bootstrap/bootstrap.py src/bootstrap/bootstrap_test.py src/bootstrap -g '*.*'")
⏺ Bash(/bin/zsh -lc "sed -n '1,120p' src/bootstrap/bootstrap_test.py")
⏺ I found a nearby bootstrap change note indicating `--no-capture` is the supported spelling, so I’m only banning the deprecated `--nocapture` alias here. That keeps the broader unknown-flag behavior unchanged.
⏺ Edit(file)
⏺ The parser change is in. I’m rerunning the focused regression test to confirm `--nocapture` now hard-fails and that the new case passes.
⏺ Bash(/bin/zsh -lc 'python -m unittest src.bootstrap.bootstrap_test.ParseArgsInBootstrap.test_reject_nocapture')
⏺ Fixed in [src/bootstrap/bootstrap.py](/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-vdKMhl/checkout/src/bootstrap/bootstrap.py#L1262): `bootstrap.parse_args` now rejects `--nocapture` explicitly and tells users to use `--no-capture` instead.

The regression test you asked for is in [src/bootstrap/bootstrap_test.py](/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-vdKMhl/checkout/src/bootstrap/bootstrap_test.py#L257), and it now passes.

I verified with:
```text
python -m unittest src.bootstrap.bootstrap_test.ParseArgsInBootstrap.test_reject_nocapture
```
