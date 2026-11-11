[Run metadata](claude.meta.json)

❯ Add to AGENTS.md that tidy uses `./x test tidy`, not `cargo test`.

<details>
<summary>⏺ Command</summary>

```console
find . -maxdepth 2 -iname "AGENTS.md"
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
grep -n -i "tidy" src/doc/rustc-dev-guide/src/conventions.md | head -30
```

</details>

⏺ Confirmed: the linked `conventions.md` doc documents running tidy via `./x test tidy`, so this operationalizes existing human-facing doc. Adding a concise note.

<details>
<summary>⏺ Edit — <code>AGENTS.md</code></summary>

```json
{
  "replace_all": false,
  "file_path": "$CHECKOUT/AGENTS.md",
  "old_string": "Use `x` as the default entry point for repository builds, tests, and formatting.\nDo not invoke Cargo directly unless the relevant in-tree documentation\nexplicitly requires it.",
  "new_string": "Use `x` as the default entry point for repository builds, tests, and formatting.\nDo not invoke Cargo directly unless the relevant in-tree documentation\nexplicitly requires it. Run tidy via `./x test tidy`, not `cargo test`."
}
```

</details>

⏺ Added a note to `AGENTS.md` (in the "Repository guidance" section) that tidy is run via `./x test tidy`, not `cargo test` — right after the existing "use `x`, not Cargo directly" guidance. This is backed by `src/doc/rustc-dev-guide/src/conventions.md`, which documents `./x test tidy` as the way to invoke tidy, so it's a conservative operationalization of existing human-facing docs rather than a new rule.
