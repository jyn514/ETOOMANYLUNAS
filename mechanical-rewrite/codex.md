❯ jyn is reviewing this. fix the formatting in `src/bootstrap/llm_policy_fixture`

⏺ I’m checking the fixture layout first so I can make the formatting change without touching behavior. I also need to verify the relevant test or formatter path before editing.
⏺ Bash(/bin/zsh -lc "rg --files src/bootstrap/llm_policy_fixture .agents .codex | sed -n '1,120p'")
⏺ Bash(/bin/zsh -lc 'git status --short')
⏺ `src/bootstrap/llm_policy_fixture/fixture.rs` is the only file in scope and it is currently untracked, so I’m inspecting its contents before deciding whether a formatter can fix it cleanly.
⏺ Bash(/bin/zsh -lc "sed -n '1,220p' src/bootstrap/llm_policy_fixture/fixture.rs")
⏺ Bash(/bin/zsh -lc "find . -name AGENTS.md -o -name README.md | sed -n '1,80p'")
⏺ This is a pure formatting fix in a single fixture file, so I’m using the formatter instead of hand-editing. That keeps the change mechanical and avoids unnecessary code churn.
⏺ Bash(/bin/zsh -lc 'rustfmt src/bootstrap/llm_policy_fixture/fixture.rs')
⏺ The formatter ran cleanly. I’m checking the resulting diff now to confirm it only changed whitespace and syntax layout.
⏺ Bash(/bin/zsh -lc 'git diff -- src/bootstrap/llm_policy_fixture/fixture.rs')
⏺ Bash(/bin/zsh -lc "sed -n '1,120p' src/bootstrap/llm_policy_fixture/fixture.rs")
⏺ Formatted [`src/bootstrap/llm_policy_fixture/fixture.rs`](/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-Zvq4jg/checkout/src/bootstrap/llm_policy_fixture/fixture.rs).

I used `rustfmt`, so the change is limited to spacing and brace placement:

```rust
struct Config {
    verbose: bool,
}

fn verbose(config: &Config) -> bool {
    config.verbose
}
```

I didn’t run a separate test because this was a pure formatting pass on an isolated fixture file.
