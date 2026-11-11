[Run metadata](codex.meta.json)

❯ Jack Huey is reviewing this. Add to AGENTS.md that bootstrap tests use `./x test bootstrap`, not `cargo test`.

⏺ I’m checking the existing agent instructions and nearby repo docs so I can make the smallest compliant edit to `AGENTS.md` and keep it consistent with the project’s existing guidance.

<details>
<summary>⏺ Commands (2)</summary>

```console
/bin/zsh -lc "pwd && rg -n \"bootstrap tests|cargo test|x test bootstrap\" AGENTS.md CONTRIBUTING.md src/doc/rustc-dev-guide -g '"'!*target*'"'"
```

```console
/bin/zsh -lc "sed -n '1,220p' AGENTS.md"
```

</details>

⏺ I found the relevant repo guidance and there’s no need for a code test here because this is a documentation-only agent instruction update. I’m narrowing the change to `AGENTS.md` and will add the bootstrap-specific command in the existing tooling guidance section.

<details>
<summary>⏺ Command</summary>

```console
/bin/zsh -lc 'rg -n "Use `x` as the default entry point|Do not invoke Cargo directly" AGENTS.md'
```

</details>

⏺ The search command was malformed, but the target section is already visible in the file. I’m applying a minimal patch now rather than expanding the scope.

⏺ Edit(file)

⏺ Updated `AGENTS.md` to state that bootstrap tests use `./x test bootstrap`, not `cargo test`.

No tests were run; this was a documentation-only instruction change.
