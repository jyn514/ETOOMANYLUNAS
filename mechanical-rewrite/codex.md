❯ jyn is reviewing this. fix the formatting in `src/bootstrap/llm_policy_fixture`

⏺ I’m checking the local instructions and the fixture layout first, then I’ll apply the smallest formatting-only change that matches the repo’s formatter rules.
<details>
<summary>⏺ Commands (2)</summary>

```console
/bin/zsh -lc 'rg --files src/bootstrap/llm_policy_fixture'
```

```console
/bin/zsh -lc "pwd && rg -n --hidden --glob 'AGENTS.md' --glob '"'!**/.git/**'"' '"'^#|''^##|''^###'"' ."
```

</details>
⏺ I found the target file. Next I’m inspecting the current formatting so I can decide whether this is a pure mechanical rewrite and whether an existing formatter should handle it.
<details>
<summary>⏺ Commands (2)</summary>

```console
/bin/zsh -lc "sed -n '1,240p' src/bootstrap/llm_policy_fixture/fixture.rs"
```

```console
/bin/zsh -lc "find src/bootstrap/llm_policy_fixture -maxdepth 2 -name 'AGENTS.md' -o -name 'rustfmt.toml' -o -name 'fmt.toml'"
```

</details>
⏺ This is a straight formatting fix, so I’m using the repo formatter rather than hand-editing the file. After that I’ll verify the diff is only whitespace/formatting.
⏺ The formatter is still running and bootstrapping tools. I’m waiting for it to finish before checking the result.
⏺ Formatter is still building its bootstrap dependencies. Once it exits I’ll confirm the file was normalized and nothing else changed.
<details>
<summary>⏺ Command</summary>

```console
/bin/zsh -lc 'x fmt src/bootstrap/llm_policy_fixture/fixture.rs'
```

</details>
⏺ `x fmt` rejected file arguments, so I’m rerunning it in the repo-supported `--all` mode. That should still apply the formatting-only rewrite without touching semantics.
<details>
<summary>⏺ Command</summary>

```console
/bin/zsh -lc 'x fmt --all'
```

</details>
⏺ The formatter is now running in the supported mode. I’m waiting for completion, then I’ll inspect the exact diff.
⏺ Formatting completed successfully. I’m checking the diff now so I can confirm it stayed scoped to the requested fixture file.
<details>
<summary>⏺ Commands (2)</summary>

```console
/bin/zsh -lc 'git diff -- src/bootstrap/llm_policy_fixture/fixture.rs'
```

```console
/bin/zsh -lc 'git status --short'
```

</details>
⏺ Formatted [`src/bootstrap/llm_policy_fixture/fixture.rs`](/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-eEEWsT/checkout/src/bootstrap/llm_policy_fixture/fixture.rs).

Also note `x fmt --all` touched one unrelated file: [`compiler/rustc_hir_analysis/src/hir_ty_lowering/mod.rs`](/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-eEEWsT/checkout/compiler/rustc_hir_analysis/src/hir_ty_lowering/mod.rs). I left it alone.
