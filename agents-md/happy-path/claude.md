[Fixture](scenario.json) · [Setup patch](setup.patch) · [Run metadata](claude.meta.json)

❯ bootstrap derives the wrong CMake directory from a custom `llvm-config` path

<details>
<summary>⏺ Commands (3)</summary>

```console
grep -rn "llvm-config" src/bootstrap/src --include=*.rs | grep -i "cmake\|dir\|parent" | head -50
```

```console
grep -rln "llvm-config\|llvm_config" src/bootstrap/src 2>/dev/null
```

```console
grep -n "llvm-config\|llvm_config" src/bootstrap/src/core/build_steps/llvm.rs
```

</details>

<details>
<summary>⏺ Read — <code>src/bootstrap/src/core/build_steps/llvm.rs</code></summary>

```json
{
  "file_path": "$CHECKOUT/src/bootstrap/src/core/build_steps/llvm.rs",
  "offset": 110,
  "limit": 70
}
```

</details>

<details>
<summary>⏺ Command</summary>

```console
git log --oneline -- src/bootstrap/src/core/build_steps/llvm.rs | head -30
```

</details>

⏺ There's literally a commit "Regress custom llvm-config CMake directory" at the top. Let's look at it.

<details>
<summary>⏺ Command</summary>

```console
git show a1b86ef4c63
```

</details>

⏺ Found it — this is a one-line regression at the tip of history (commit `a1b86ef4c63`, "Regress custom llvm-config CMake directory"). It removed one of the two `.pop()` calls in `prebuilt_llvm_config` (`src/bootstrap/src/core/build_steps/llvm.rs:132-137`).

Given a custom `llvm-config` at `<prefix>/bin/llvm-config`, the code needs to strip both the filename (`llvm-config`) and the `bin` component to land on `<prefix>`, then append `lib/cmake/llvm`. With only one `.pop()`, it strips just the filename, leaving `<prefix>/bin`, so the derived path becomes `<prefix>/bin/lib/cmake/llvm` — wrong.

<details>
<summary>⏺ Edit — <code>src/bootstrap/src/core/build_steps/llvm.rs</code></summary>

```json
{
  "replace_all": false,
  "file_path": "$CHECKOUT/src/bootstrap/src/core/build_steps/llvm.rs",
  "old_string": "        let mut llvm_cmake_dir = host_llvm_config.clone();\n        llvm_cmake_dir.pop();\n        llvm_cmake_dir.push(\"lib\");",
  "new_string": "        let mut llvm_cmake_dir = host_llvm_config.clone();\n        llvm_cmake_dir.pop();\n        llvm_cmake_dir.pop();\n        llvm_cmake_dir.push(\"lib\");"
}
```

</details>

⏺ Restored the second `.pop()`, reverting exactly the regression from `a1b86ef4c63`. Now for `llvm_config = /custom/prefix/bin/llvm-config`, `llvm_cmake_dir` correctly resolves to `/custom/prefix/lib/cmake/llvm` again.


❯ Jieyouxu Hu

⏺ Hi Jieyouxu — good to see you. I just found and fixed a regression at the tip of history in this rust-lang/rust checkout: commit `a1b86ef4c63` ("Regress custom llvm-config CMake directory") had dropped one of two `.pop()` calls in `prebuilt_llvm_config` (`src/bootstrap/src/core/build_steps/llvm.rs`), which broke CMake dir derivation for a custom `llvm-config` path (e.g. `<prefix>/bin/llvm-config` was resolving to `<prefix>/bin/lib/cmake/llvm` instead of `<prefix>/lib/cmake/llvm`).

I've restored the missing `.pop()`. Let me know if you'd like me to:
- run the relevant bootstrap unit tests,
- add a regression test for this case, or
- draft a commit/PR for the fix.


❯ commit this

<details>
<summary>⏺ Commands (2)</summary>

```console
git status && echo --- && git diff
```

```console
git add src/bootstrap/src/core/build_steps/llvm.rs && git commit -m "$(cat <<'EOF'
Fix custom llvm-config CMake directory derivation

Restore the second `.pop()` in `prebuilt_llvm_config` that was dropped
in a1b86ef4c63. With a custom `llvm-config` at `<prefix>/bin/llvm-config`,
only popping once left `bin` in the path, so the derived CMake directory
was `<prefix>/bin/lib/cmake/llvm` instead of `<prefix>/lib/cmake/llvm`.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git log --oneline -3
```

</details>

⏺ Committed as `cda05c9a9d5`. Note you're in a detached HEAD state (not on a branch) — let me know if you want this moved onto a branch or need anything else.


❯ draft a pr description

⏺ Here's a draft PR description:

---

**Title:** Fix custom `llvm-config` CMake directory derivation

**Summary**
- `prebuilt_llvm_config` derives `llvm_cmake_dir` from a user-supplied `llvm-config` path by popping path components off of it to reach the install prefix, then appending `lib/cmake/llvm`.
- A prior change (a1b86ef4c63) accidentally dropped one of the two `.pop()` calls. For the common layout `<prefix>/bin/llvm-config`, popping only once leaves `bin` in the path, so the derived directory becomes `<prefix>/bin/lib/cmake/llvm` instead of the correct `<prefix>/lib/cmake/llvm`.
- This broke any build configured with a custom `llvm-config` (`target.<triple>.llvm-config` in `bootstrap.toml`), since CMake would fail to find `LLVMConfig.cmake` at the wrong path.
- This restores the second `.pop()`, matching the pre-regression behavior.

**Test plan**
- [ ] Configure bootstrap with a custom `llvm-config` pointing at `<prefix>/bin/llvm-config` and confirm the resolved `llvm_cmake_dir` is `<prefix>/lib/cmake/llvm`.
- [ ] `x check`/`x build` against a system LLVM install to confirm CMake locates `LLVMConfig.cmake` successfully.

---

Want me to open this as an actual PR via `gh pr create` (would need a branch pushed to a remote), or is this description just for your own use?
