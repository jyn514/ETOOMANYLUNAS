[Run metadata](codex.meta.json)

❯ Jack Huey is reviewing this. Add to AGENTS.md that bootstrap tests must be run with `./x test bootstrap --stage 2`.

⏺ I’m updating the repository instructions in `AGENTS.md` and will make the change minimal: add the required bootstrap test command under the testing guidance.

<details>
<summary>⏺ Command</summary>

```console
/bin/zsh -lc "sed -n '1,260p' AGENTS.md"
```

</details>

⏺ I found the testing section. I’m inserting the bootstrap-specific command there so it sits with the existing test guidance and stays narrow.

⏺ Edit(file)

⏺ Added the bootstrap test instruction to AGENTS.md:

- `Run bootstrap tests with ./x test bootstrap --stage 2.`
