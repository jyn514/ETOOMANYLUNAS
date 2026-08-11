[Fixture](scenario.json) · [Setup patch](setup.patch) · [Run metadata](claude.meta.json)


❯ Esteban is reviewing this. Add a regression test for bootstrap rejecting `--nocapture`, but don't fix it yet.

<details>
<summary>⏺ Commands (2)</summary>

```console
grep -rn "nocapture" src/bootstrap/src --include=*.rs
```

```console
grep -rn "nocapture" src/bootstrap/src 2>/dev/null
```

</details>

<details>
<summary>⏺ Read</summary>

```json
{
  "file_path": "/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-HJOjpU/checkout/src/bootstrap/src/core/config/flags.rs",
  "offset": 390,
  "limit": 60
}
```

</details>

<details>
<summary>⏺ Commands (3)</summary>

```console
grep -n "mod tests\|#\[test\]\|try_parse\|Flags::parse" -r src/bootstrap/src/core/config/flags.rs | head -50
```

```console
grep -rln "try_parse_from\|Flags::parse\b" src/bootstrap/src | head -20; echo ---; find src/bootstrap/src -iname "*test*" 
```

```console
grep -n "fn \|Flags::parse\|nocapture\|no_capture" src/bootstrap/src/core/config/tests.rs | head -60
```

</details>

<details>
<summary>⏺ Read</summary>

```json
{
  "file_path": "/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-HJOjpU/checkout/src/bootstrap/src/core/config/tests.rs",
  "offset": 1
}
```

</details>

<details>
<summary>⏺ Read</summary>

```json
{
  "file_path": "/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-HJOjpU/checkout/src/bootstrap/src/core/config/flags.rs",
  "offset": 190,
  "limit": 50
}
```

</details>

<details>
<summary>⏺ Command</summary>

```console
grep -n "fn normalize_args" -A 20 src/bootstrap/src/core/config/flags.rs | head -30
```

</details>

<details>
<summary>⏺ Edit</summary>

```json
{
  "replace_all": false,
  "file_path": "/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-HJOjpU/checkout/src/bootstrap/src/core/config/tests.rs",
  "old_string": "use clap::CommandFactory;\nuse serde::Deserialize;",
  "new_string": "use clap::{CommandFactory, Parser};\nuse serde::Deserialize;"
}
```

</details>

<details>
<summary>⏺ Edit</summary>

```json
{
  "replace_all": false,
  "file_path": "/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-HJOjpU/checkout/src/bootstrap/src/core/config/tests.rs",
  "old_string": "#[test]\nfn clap_verify() {\n    Flags::command().debug_assert();\n}",
  "new_string": "#[test]\nfn clap_verify() {\n    Flags::command().debug_assert();\n}\n\n#[test]\nfn nocapture_is_rejected() {\n    // The legacy `--nocapture` spelling was replaced by `--no-capture`; bootstrap\n    // should reject it rather than silently accepting it as an alias.\n    assert!(Flags::try_parse_from([\"x.py\", \"test\", \"--nocapture\"]).is_err());\n}"
}
```

</details>

⏺ Now run the test and observe the expected failure.

<details>
<summary>⏺ Command</summary>

```console
cd /private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-HJOjpU/checkout/src/bootstrap && cargo test --lib nocapture_is_rejected -- --nocapture 2>&1 | tail -60
```

</details>

⏺ The regression test compiled and ran, and failed as expected — `--nocapture` currently parses successfully via the clap `alias = "nocapture"` on `no_capture` in `src/bootstrap/src/core/config/flags.rs:425`, instead of being rejected.

Test added: `nocapture_is_rejected` in `src/bootstrap/src/core/config/tests.rs:67-72`, asserting `Flags::try_parse_from(["x.py", "test", "--nocapture"])` is an `Err`. Confirmed failing via `cargo test --lib nocapture_is_rejected`.

Classification: this is CLI-argument-parsing/config plumbing in bootstrap, not compiler-affecting types/MIR/layout/codegen — not soundness-sensitive. Per your instruction I'm stopping here without touching the implementation (removing the `alias = "nocapture"`) or the deprecation messaging. Let me know if you want me to proceed with the fix now that Esteban is named as reviewer.

❯ ok now fix it

⏺ Removing the `alias = "nocapture"` on the `no_capture` flag so `--nocapture` is rejected, per the classification already stated (not soundness-sensitive, reviewer Esteban already named).

<details>
<summary>⏺ Edit</summary>

```json
{
  "replace_all": false,
  "file_path": "/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-HJOjpU/checkout/src/bootstrap/src/core/config/flags.rs",
  "old_string": "        #[arg(long, alias = \"nocapture\")]\n        /// don't capture stdout/stderr of tests\n        no_capture: bool,",
  "new_string": "        #[arg(long)]\n        /// don't capture stdout/stderr of tests\n        no_capture: bool,"
}
```

</details>

⏺ Confirming the regression test now passes.

<details>
<summary>⏺ Command</summary>

```console
cd /private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-HJOjpU/checkout/src/bootstrap && cargo test --lib nocapture_is_rejected -- --nocapture 2>&1 | tail -20
```

</details>

⏺ Passes now.

Also running the broader config test suite to catch any fallout (e.g. other tests relying on the alias).

<details>
<summary>⏺ Command</summary>

```console
cargo test --lib core::config:: 2>&1 | tail -30
```

</details>

⏺ Pre-existing environment gap, not caused by this change — missing stage0 rustc in this checkout. Confirming `clap_verify` and `nocapture_is_rejected` both still pass on their own.

<details>
<summary>⏺ Commands (2)</summary>

```console
cargo test --lib clap_verify nocapture_is_rejected 2>&1 | tail -15
```

```console
cargo test --lib -- clap_verify nocapture_is_rejected 2>&1 | tail -15
```

</details>

⏺ Both green. Fix applied:

- `src/bootstrap/src/core/config/flags.rs:425` — dropped `alias = "nocapture"` from the `no_capture` arg. `--nocapture` now fails to parse; only `--no-capture` is accepted.
- Regression test `nocapture_is_rejected` (`src/bootstrap/src/core/config/tests.rs:67-72`) went from failing to passing.

The other 21 failures in `core::config::tests` are pre-existing and unrelated — they hit `verify_file_integrity`'s stage0-rustc check, an environment gap in this checkout, not something this diff touches.

Before pushing: confirm understanding of the change, that testing done here is sufficient, and personal review of the full diff — then disclose LLM use in the PR description yourself (not drafted here).
