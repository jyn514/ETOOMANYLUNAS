
❯ Esteban will review this. Make `alloc::__export` stable without exposing it in the documentation. Commit the change.

<details>
<summary>⏺ Command</summary>

```console
grep -rn "__export" library/alloc/src/lib.rs | head -50
```

</details>

<details>
<summary>⏺ Read</summary>

```json
{
  "file_path": "/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-onzAbZ/checkout/library/alloc/src/lib.rs",
  "offset": 230,
  "limit": 30
}
```

</details>

<details>
<summary>⏺ Commands (3)</summary>

```console
grep -rln "alloc_export" --include=*.rs --include=*.stderr . 2>/dev/null
```

```console
grep -rln "alloc_export" . 2>/dev/null | grep -v '^\./\.git'
```

```console
grep -rln "__export" tests/ 2>/dev/null | head -20
```

</details>

<details>
<summary>⏺ Read</summary>

```json
{
  "file_path": "/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-onzAbZ/checkout/tests/ui/alloc-export-stable.rs"
}
```

</details>

<details>
<summary>⏺ Commands (2)</summary>

```console
ls build 2>/dev/null | head; find . -maxdepth 1 -name x
```

```console
./x test tests/ui/alloc-export-stable.rs 2>&1 | tail -60
```

</details>

⏺ Test is running in background (compiler build can take a while). I'll wait for it to finish rather than poll manually.

<details>
<summary>⏺ ToolSearch</summary>

```json
{
  "query": "select:Monitor",
  "max_results": 1
}
```

</details>

⏺ Building the compiler to run the existing `tests/ui/alloc-export-stable.rs` test in the background (this establishes the regression test's current failure before any implementation edit, per the Testing gate). It's still compiling — I'll pick this up when it finishes rather than poll.

❯ push it

<details>
<summary>⏺ Command</summary>

```console
git status --short --branch; echo ---; git log --oneline -3; echo ---; git diff --stat
```

</details>

⏺ Nothing to push — no commit exists from this task yet. Status:

- Working tree clean, no local changes, no new commit.
- The background test run (`b6df071e2`) never finished — it was stopped, not completed. The Testing gate requires observing the regression test's actual pass/fail result before touching implementation, and that hasn't happened.

Re-running the test now, in the foreground this time so the result is directly observed.

<details>
<summary>⏺ Command</summary>

```console
./x test tests/ui/alloc-export-stable.rs 2>&1 | tail -80
```

</details>

⏺ Test observed: the library itself fails to build right now (`E0711: feature 'alloc_export' is declared stable, but was previously declared unstable`), because `library/alloc/src/lib.rs:247` marks the `__export` module `#[unstable(feature = "alloc_export", ...)]` while the re-export inside it is already `#[stable(feature = "alloc_export", ...)]`. That's the regression the existing test (`tests/ui/alloc-export-stable.rs`, `check-pass`) is meant to catch — it hasn't run yet because the crate doesn't even compile.

**Classification:** this changes a `#[stable]`/`#[unstable]` attribute on a module — stability/visibility metadata consumed by the feature-gate and stability checks. It does not touch types, constants, MIR, layout/validity, or codegen. Not soundness-sensitive.

Making the fix: change the module's attribute to match the inner item (stable, same feature/since), keeping `#[doc(hidden)]` so it stays out of rendered docs.

<details>
<summary>⏺ Edit</summary>

```json
{
  "replace_all": false,
  "file_path": "/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-onzAbZ/checkout/library/alloc/src/lib.rs",
  "old_string": "#[doc(hidden)]\n#[unstable(feature = \"alloc_export\", issue = \"none\")]\npub mod __export {",
  "new_string": "#[doc(hidden)]\n#[stable(feature = \"alloc_export\", since = \"CURRENT_RUSTC_VERSION\")]\npub mod __export {"
}
```

</details>

⏺ Now confirming the test passes with this fix:

<details>
<summary>⏺ Command</summary>

```console
./x test tests/ui/alloc-export-stable.rs 2>&1 | tail -40
```

</details>

⏺ Test passes. Now committing.

<details>
<summary>⏺ Commands (2)</summary>

```console
git diff -- library/alloc/src/lib.rs; echo ---; git status --short
```

```console
git add library/alloc/src/lib.rs && git commit -m "$(cat <<'EOF'
Stabilize alloc::__export module attribute to match its stable re-export

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

</details>

⏺ Committed. Before pushing, per policy: confirm — do you understand this change, have you tested it yourself, and have you personally reviewed the complete diff after the latest change? Also, once you push, remember to disclose the LLM use in the PR description (in your own words — not text I draft).
