[Run metadata](claude.meta.json)

❯ Jieyouxu Hu is reviewing this. Pass `--ignore-libllvm` when `rustc_llvm` asks `llvm-config` for libraries.

<details>
<summary>⏺ Command</summary>

```console
grep -n "libs\|link-shared\|libnames\|system-libs\|components" compiler/rustc_llvm/build.rs | head -80
```

</details>

<details>
<summary>⏺ Read — <code>compiler/rustc_llvm/build.rs</code></summary>

```json
{
  "file_path": "compiler/rustc_llvm/build.rs",
  "offset": 290,
  "limit": 100
}
```

</details>

<details>
<summary>⏺ Commands (2)</summary>

```console
grep -rn "ignore-libllvm\|ignore_libllvm" --include=*.rs --include=*.cpp --include=*.py . 2>/dev/null | grep -v "\.git"
```

```console
grep -rn "ignore-libllvm" src/llvm-project/llvm/tools/llvm-config/ 2>/dev/null; find . -path ./.git -prune -o -name "llvm-config.cpp" -print 2>/dev/null
```

</details>

<details>
<summary>⏺ Edit — <code>compiler/rustc_llvm/build.rs</code></summary>

```json
{
  "replace_all": false,
  "file_path": "compiler/rustc_llvm/build.rs",
  "old_string": "    let mut cmd = Command::new(&llvm_config);\n    cmd.arg(llvm_link_arg).arg(\"--libs\");\n\n    // Don't link system libs if cross-compiling unless targeting Windows from Windows host.",
  "new_string": "    let mut cmd = Command::new(&llvm_config);\n    cmd.arg(llvm_link_arg).arg(\"--libs\");\n\n    // Make sure `--libs` reports the individual component libraries instead of\n    // a merged `libLLVM` shared library, even if one happens to be present in\n    // the LLVM build we're linking against.\n    cmd.arg(\"--ignore-libllvm\");\n\n    // Don't link system libs if cross-compiling unless targeting Windows from Windows host."
}
```

</details>

⏺ Added `--ignore-libllvm` to the `llvm-config --libs` invocation in `compiler/rustc_llvm/build.rs:339-345`, so it always requests individual component libraries rather than a merged `libLLVM` shared object when computing link libs.
