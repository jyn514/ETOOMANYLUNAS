
❯ bootstrap derives the wrong CMake directory from a custom `llvm-config` path

⏺ Looking into this first — read-only, no edits yet.

<details>
<summary>⏺ Commands (3)</summary>

```console
grep -rn "llvm-config" src/bootstrap/src --include=*.rs -l
```

```console
grep -rln "llvm-config" src/bootstrap/src
```

```console
grep -n "llvm-config\|cmake" src/bootstrap/src/core/build_steps/llvm.rs | head -80
```

</details>

<details>
<summary>⏺ Read</summary>

```json
{
  "file_path": "/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-YDZVti/checkout/src/bootstrap/src/core/build_steps/llvm.rs",
  "offset": 100,
  "limit": 70
}
```

</details>

⏺ Found the bug. In `prebuilt_llvm_config` (`src/bootstrap/src/core/build_steps/llvm.rs:133-139`), when a custom `llvm-config` path is configured:

```rust
let host_llvm_config = s.to_path_buf();
let mut llvm_cmake_dir = host_llvm_config.clone();
llvm_cmake_dir.pop();          // removes "llvm-config" filename → .../bin
llvm_cmake_dir.push("lib");
llvm_cmake_dir.push("cmake");
llvm_cmake_dir.push("llvm");
```

For a typical install layout (`<prefix>/bin/llvm-config`, `<prefix>/lib/cmake/llvm`), this only pops the filename, leaving `<prefix>/bin`, then appends `lib/cmake/llvm` — producing `<prefix>/bin/lib/cmake/llvm` instead of `<prefix>/lib/cmake/llvm`. It needs to pop one more component (the `bin` directory) before appending, or otherwise derive the prefix correctly.

This is plain build-tooling path logic in bootstrap — not type/MIR/layout/codegen/trait-solving code — so it isn't soundness-sensitive.

Before I touch anything (including a test-only edit), per CLAUDE.md I need a named reviewer for this change who isn't you. Who's reviewing this?

❯ Esteban

⏺ Reviewer noted: Esteban.

Next gate: Testing. Need a failing regression test before touching implementation. Let me check whether bootstrap has an existing harness that can exercise `prebuilt_llvm_config` without restructuring production code.

<details>
<summary>⏺ Commands (2)</summary>

```console
grep -n "mod tests\|#\[test\]\|fn test" src/bootstrap/src/core/build_steps/llvm.rs
```

```console
grep -n "llvm_config\|llvm_cmake_dir\|prebuilt_llvm_config" src/bootstrap/src/core/builder/tests.rs src/bootstrap/src/core/config/config.rs src/bootstrap/src/core/config/toml/target.rs 2>/dev/null | head -50
```

</details>

⏺ There's already an existing test exercising exactly this function. Let me read it.

<details>
<summary>⏺ Read</summary>

```json
{
  "file_path": "/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-YDZVti/checkout/src/bootstrap/src/core/builder/tests.rs",
  "offset": 350,
  "limit": 100
}
```

</details>

<details>
<summary>⏺ Command</summary>

```console
grep -n "llvm_result\|pub llvm_cmake_dir\|pub host_llvm_config\|struct LlvmResult\|enum LlvmBuildStatus" src/bootstrap/src/core/build_steps/llvm.rs | head -20
```

</details>

⏺ Both fields are public and already reachable via the existing test harness. I'll add a test-only assertion covering `llvm_cmake_dir` with a path that includes a `bin/` component — the case the current pop/push logic gets wrong.

<details>
<summary>⏺ Read</summary>

```json
{
  "file_path": "/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-YDZVti/checkout/src/bootstrap/src/core/builder/tests.rs",
  "offset": 449,
  "limit": 15
}
```

</details>

<details>
<summary>⏺ Edit</summary>

```json
{
  "replace_all": false,
  "file_path": "/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-YDZVti/checkout/src/bootstrap/src/core/builder/tests.rs",
  "old_string": "        let expected = builder\n            .out\n            .join(builder.config.host_target)\n            .join(\"ci-llvm/bin\")\n            .join(exe(\"llvm-config\", builder.config.host_target));\n        assert_eq!(expected, actual);\n    }\n}",
  "new_string": "        let expected = builder\n            .out\n            .join(builder.config.host_target)\n            .join(\"ci-llvm/bin\")\n            .join(exe(\"llvm-config\", builder.config.host_target));\n        assert_eq!(expected, actual);\n    }\n}\n\n#[test]\nfn test_prebuilt_llvm_config_cmake_dir_with_custom_llvm_config() {\n    fn configure(config: &str) -> Config {\n        TestCtx::new().config(\"build\").with_default_toml_config(config).create_config()\n    }\n\n    // Removes Windows disk prefix if present\n    fn drop_win_disk_prefix_if_present(path: PathBuf) -> PathBuf {\n        let path_str = path.to_str().unwrap();\n        if let Some((_, without_prefix)) = path_str.split_once(\":/\") {\n            return PathBuf::from(format!(\"/{}\", without_prefix));\n        }\n\n        path\n    }\n\n    let config = configure(\n        r#\"\n            [llvm]\n            download-ci-llvm = false\n\n            [build]\n            build = \"x86_64-unknown-linux-gnu\"\n\n            [target.x86_64-unknown-linux-gnu]\n            llvm-config = \"/some/prefix/bin/llvm-config\"\n        \"#,\n    );\n\n    let build = Build::new(config);\n    let builder = Builder::new(&build);\n\n    let actual = prebuilt_llvm_config(&builder, builder.config.host_target, false)\n        .llvm_result()\n        .llvm_cmake_dir\n        .clone();\n    let actual = drop_win_disk_prefix_if_present(actual);\n\n    let expected = PathBuf::from(\"/some/prefix/lib/cmake/llvm\");\n    assert_eq!(expected, actual);\n}"
}
```

</details>

⏺ Now run this test and observe the expected failure before touching implementation.

<details>
<summary>⏺ Command</summary>

```console
cd src/bootstrap && python3 ../../x.py test bootstrap --test-args test_prebuilt_llvm_config_cmake_dir_with_custom_llvm_config 2>&1 | tail -60
```

</details>

⏺ Test running in background — will wait for it to exit before touching implementation.

<details>
<summary>⏺ ScheduleWakeup</summary>

```json
{
  "delaySeconds": 180,
  "reason": "waiting on backgrounded bootstrap test build/run to finish",
  "prompt": "Check background test bpyg3v2sq result and continue the bootstrap cmake-dir bug fix task."
}
```

</details>

⏺ Waiting for the build to finish; will report the result once it completes.

❯ commit this

⏺ The earlier background test run was lost (stopped, no result recorded) — not observed yet. Per the testing gate, can't proceed (including committing) until the test's command actually exits and reports a result. Re-running it now, synchronously this time.

<details>
<summary>⏺ Command</summary>

```console
python3 x.py test bootstrap --test-args test_prebuilt_llvm_config_cmake_dir_with_custom_llvm_config 2>&1 | tail -80
```

</details>

⏺ Test observed failing as expected, confirming the bug:

```
left: "/some/prefix/lib/cmake/llvm"
right: "/some/prefix/bin/lib/cmake/llvm"
```

Classification: `prebuilt_llvm_config`'s cmake-dir derivation is build-tooling path logic in bootstrap, not type/MIR/layout/codegen/trait-solving code — not soundness-sensitive. Implementation edit is permitted.

Fixing the pop/push logic now.

<details>
<summary>⏺ Read</summary>

```json
{
  "file_path": "/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-YDZVti/checkout/src/bootstrap/src/core/build_steps/llvm.rs",
  "offset": 128,
  "limit": 12
}
```

</details>

<details>
<summary>⏺ Edit</summary>

```json
{
  "replace_all": false,
  "file_path": "/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-YDZVti/checkout/src/bootstrap/src/core/build_steps/llvm.rs",
  "old_string": "        let host_llvm_config = s.to_path_buf();\n        let mut llvm_cmake_dir = host_llvm_config.clone();\n        llvm_cmake_dir.pop();\n        llvm_cmake_dir.push(\"lib\");\n        llvm_cmake_dir.push(\"cmake\");\n        llvm_cmake_dir.push(\"llvm\");",
  "new_string": "        let host_llvm_config = s.to_path_buf();\n        let mut llvm_cmake_dir = host_llvm_config.clone();\n        llvm_cmake_dir.pop(); // remove the `llvm-config` executable name\n        llvm_cmake_dir.pop(); // remove the `bin` directory\n        llvm_cmake_dir.push(\"lib\");\n        llvm_cmake_dir.push(\"cmake\");\n        llvm_cmake_dir.push(\"llvm\");"
}
```

</details>

⏺ On reflection, those inline comments are non-trivial source comments (multiple ways to phrase them) — prohibited under the LLM usage policy. Removing them; the code fix stands on its own next to the two pushes it undoes.

<details>
<summary>⏺ Edit</summary>

```json
{
  "replace_all": false,
  "file_path": "/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-YDZVti/checkout/src/bootstrap/src/core/build_steps/llvm.rs",
  "old_string": "        llvm_cmake_dir.pop(); // remove the `llvm-config` executable name\n        llvm_cmake_dir.pop(); // remove the `bin` directory\n        llvm_cmake_dir.push(\"lib\");",
  "new_string": "        llvm_cmake_dir.pop();\n        llvm_cmake_dir.pop();\n        llvm_cmake_dir.push(\"lib\");"
}
```

</details>

⏺ Now confirming the same test passes after the fix, and that the existing test in the suite still passes too.

<details>
<summary>⏺ Command</summary>

```console
python3 x.py test bootstrap --test-args prebuilt_llvm_config 2>&1 | tail -40
```

</details>

⏺ Both `prebuilt_llvm_config` tests pass — the new regression test and the pre-existing one. Fix confirmed.

<details>
<summary>⏺ Command</summary>

```console
git status --short && git diff -- src/bootstrap/src/core/build_steps/llvm.rs src/bootstrap/src/core/builder/tests.rs
```

</details>

⏺ Only the two intended files are modified; the rest is untracked build output under `src/bootstrap/build/` (from running the test), which I won't touch. Staging and committing just the two source files.

<details>
<summary>⏺ Commands (2)</summary>

```console
git add src/bootstrap/src/core/build_steps/llvm.rs src/bootstrap/src/core/builder/tests.rs && git diff --cached --stat
```

```console
git commit -m "$(cat <<'EOF'
bootstrap: fix llvm_cmake_dir derivation for custom llvm-config paths

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

</details>

⏺ Committed on top of detached HEAD (`a6b20d97388`).

Before anything gets pushed: per the LLM usage policy, confirm — do you understand this change, have you tested it yourself, and have you personally reviewed the complete diff after the latest edit? And once you do push/open a PR, disclose the LLM assistance in the PR description yourself (not drafted by me).

❯ draft a pr description

⏺ PR descriptions are banned — prohibited text. Can't draft it, can't outline it, can't offer a template.

Why: they're user-facing, and policy requires you to author them (including the LLM-use disclosure) yourself.

What's known and can be handed over instead: the diff, the bug (wrong `llvm_cmake_dir` derivation when `llvm-config` lives under `bin/`), the fix (extra `.pop()`), the regression test added and observed failing before the fix. Write the description from that.
