All files named `claude.md` collected using Sonnet 4.6 with medium effort.
Codex transcripts use `gpt-5.4-mini`.
`❯` indicates that this is a user prompt.
"## suggested" indicates that I did not write the prompt myself and just hit right arrow to accept a suggestion.

## Generating transcripts

Use `scripts/generate-transcripts.mjs` to run the same prompt scenarios through Claude Code or Codex non-interactively.
Scenarios live in each transcript directory as `scenario.json`.
Runs exclude the caller's global agent instructions (`~/.claude/CLAUDE.md` and `~/.codex/AGENTS.md`) while still allowing repository-local instruction files in the Rust checkout.
Runs allow agent network access for issue lookup: Claude is invoked with `WebFetch` and `WebSearch`, and Codex is invoked with `sandbox_workspace_write.network_access=true`.
Agent subprocesses run with non-interactive Git/SSH prompts disabled. Already-loaded `ssh-agent` keys still work, but missing keys fail instead of opening a passphrase prompt.

```sh
./scripts/generate-transcripts.mjs --rust-repo /path/to/rust-lang/rust --provider claude
./scripts/generate-transcripts.mjs --rust-repo /path/to/rust-lang/rust --provider codex
```

Useful flags:

- `--only diagnostics` runs one scenario.
- `--skip diagnostics` skips one scenario. Repeat it to skip multiple scenarios.
- `--jobs 4` runs up to four scenario/provider runs at once. Turns within one scenario still run serially.
- `--dry-run` prints commands without calling the model.
- `--provider claude|codex` selects a provider. Repeat it to run multiple providers. If omitted, both run.

If `claude` or `codex` is not on `PATH`, set `CLAUDE_BIN=/full/path/to/claude` or `CODEX_BIN=/full/path/to/codex`.

Each run writes `<scenario>/<provider>.md`. The raw JSONL event stream is only used while rendering the Markdown transcript.
