All files named `claude.md` collected using Sonnet 4.6 with medium effort.
Codex transcripts use `gpt-5.4-mini`.
`❯` indicates that this is a user prompt.
"## suggested" indicates that I did not write the prompt myself and just hit right arrow to accept a suggestion.

## Generating transcripts

Use `scripts/generate-transcripts.mjs` to run the same prompt scenarios through Claude Code or Codex non-interactively.
Scenarios live in each transcript directory as `scenario.json`.
Runs exclude the caller's global agent instructions (`~/.claude/CLAUDE.md` and `~/.codex/AGENTS.md`) while still allowing repository-local instruction files in the Rust checkout.
Runs allow agent network access for issue lookup: Claude is invoked with `WebFetch` and `WebSearch`, and Codex is invoked with `sandbox_workspace_write.network_access=true`.
Agent subprocesses run with non-interactive Git/SSH prompts disabled. SSH agent access is cleared, and Git/SSH askpass helpers are forced to fail fast instead of opening a prompt.
Set `TRANSCRIPTS_ALLOW_SSH_PROMPTS=1` only if you want to restore inherited SSH agent behavior.
The runner snapshots the Rust checkout's current repository-local agent instructions (`CLAUDE.md`,
`AGENTS.md`, `.claude`, `.codex`, and `.agents`), including uncommitted and non-ignored untracked
files. It then creates a disposable shared Git clone for each scenario/provider run. Other checkout
changes are not included. Each run has independent writable Git metadata and initializes the Cargo
and backtrace submodules inside its clone, so Rust's `x` commands and local commits cannot mutate the
supplied checkout. This keeps parallel runs independent.
Codex runs receive isolated command rules that allow `git add` and `git commit` to write the
disposable clone's protected Git metadata. No rule permits pushing.
Bootstrap downloads are shared across those clones through `bootstrap-cache-path`. The cache defaults
to `$XDG_CACHE_HOME/definitely-not-rust/bootstrap`, or `~/.cache/definitely-not-rust/bootstrap` when
`XDG_CACHE_HOME` is unset. Set `TRANSCRIPTS_BOOTSTRAP_CACHE` to use another location. This reuses
downloaded archives, not build outputs.

```sh
./scripts/generate-transcripts.mjs --rust-repo /path/to/rust-lang/rust --provider claude
./scripts/generate-transcripts.mjs --rust-repo /path/to/rust-lang/rust --provider codex
```

Useful flags:

- `--only diagnostics` runs one scenario. Repeat it to run multiple scenarios.
- `--skip diagnostics` skips one scenario. Repeat it to skip multiple scenarios.
- `--jobs 4` runs up to four scenario/provider runs at once. Turns within one scenario still run serially.
- `--dry-run` prints commands without calling the model.
- `--provider claude|codex` selects a provider. Repeat it to run multiple providers. If omitted, both run.

If `claude` or `codex` is not on `PATH`, set `CLAUDE_BIN=/full/path/to/claude` or `CODEX_BIN=/full/path/to/codex`.

The script prints per-run and per-turn progress on stderr, including agent messages and tool events as they arrive. If a child process goes silent for 30 seconds, it emits a heartbeat line that names the stuck run and turn. Use `--no-progress` for quiet operation.

Each run writes `<scenario>/<provider>.md`. The raw JSONL event stream is only used while rendering the Markdown transcript.

## Scenario setup

A scenario can prepare its disposable worktree before the first turn:

```json
{
  "setup": {
    "patch": "setup.patch",
    "commands": ["! ./path/to/check.sh"],
    "commit": {
      "message": "Add test fixture"
    }
  },
  "turns": [
    {
      "prompt": "Work with the prepared fixture."
    }
  ]
}
```

All setup fields are optional. The runner applies `patch` relative to the scenario directory, runs each `commands` entry with `sh -c`, then stages all prepared changes and creates the optional `commit`.
Setup failures stop the run and identify the failing scenario, provider, and command.
