[Run metadata](claude.meta.json)

❯ Jieyouxu Hu is reviewing this. Add to AGENTS.md that bootstrap tests use `./x test bootstrap`, not `cargo test`.

<details>
<summary>⏺ Command</summary>

```console
find . -maxdepth 1 -iname "AGENTS.md"
```

</details>

<details>
<summary>⏺ Read — <code>AGENTS.md</code></summary>

```json
{
  "file_path": "$CHECKOUT/AGENTS.md"
}
```

</details>

<details>
<summary>⏺ Command</summary>

```console
grep -rn "test bootstrap" src/doc/rustc-dev-guide/src/ src/bootstrap/ 2>/dev/null | grep -v Binary | head -50
```

</details>

⏺ Confirmed by `src/bootstrap/README.md:224`. This fits the existing "Tests" row and the "Use `x` as default entry point" guidance. I'll add a concrete bootstrap-specific line there, linking to that source.

<details>
<summary>⏺ Edit — <code>AGENTS.md</code></summary>

```json
{
  "replace_all": false,
  "file_path": "$CHECKOUT/AGENTS.md",
  "old_string": "Use `x` as the default entry point for repository builds, tests, and formatting.\nDo not invoke Cargo directly unless the relevant in-tree documentation\nexplicitly requires it.",
  "new_string": "Use `x` as the default entry point for repository builds, tests, and formatting.\nDo not invoke Cargo directly unless the relevant in-tree documentation\nexplicitly requires it. For example, run bootstrap's own tests with\n`./x test bootstrap`, not `cargo test` (see [bootstrap README])."
}
```

</details>

<details>
<summary>⏺ Edit — <code>AGENTS.md</code></summary>

```json
{
  "replace_all": false,
  "file_path": "$CHECKOUT/AGENTS.md",
  "old_string": "[external repositories]: src/doc/rustc-dev-guide/src/external-repos.md\n[contribution process]: src/doc/rustc-dev-guide/src/contributing.md",
  "new_string": "[external repositories]: src/doc/rustc-dev-guide/src/external-repos.md\n[contribution process]: src/doc/rustc-dev-guide/src/contributing.md\n[bootstrap README]: src/bootstrap/README.md"
}
```

</details>

⏺ Added a note under "Repository guidance" in `AGENTS.md:214-217`: bootstrap tests must use `./x test bootstrap`, not `cargo test`, with a link to `src/bootstrap/README.md` (which states this directly) as the human-facing source, satisfying the operationalization requirement. Jieyouxu Hu is on record as reviewer for this change.
