❯ jyn is reviewing this. fix the formatting in `src/bootstrap/llm_policy_fixture`

⏺ I’m checking the fixture layout and the repo’s formatting path first, then I’ll make the smallest change that matches the existing style.
⏺ Command(/bin/zsh -lc 'ls -la src/bootstrap/llm_policy_fixture && find src/bootstrap/llm_policy_fixture -maxdepth 2 -type f | sort')
⏺ Command(/bin/zsh -lc 'pwd && rg -n "llm_policy_fixture|fixture" src/bootstrap -S')
⏺ Command(/bin/zsh -lc 'git status --short')
⏺ I found a single untracked fixture file, so I’m reading it directly to see whether this is just whitespace/indentation or something broader.
⏺ Command(/bin/zsh -lc "sed -n '1,120p' src/bootstrap/llm_policy_fixture/fixture.rs")
⏺ Command(/bin/zsh -lc 'git ls-files --stage -- src/bootstrap/llm_policy_fixture/fixture.rs')
⏺ Command(/bin/zsh -lc 'rg -n "llm_policy_fixture" -S .')
⏺ This is just a mechanical formatting fix, so I’m using the formatter instead of hand-editing the file. After that I’ll verify the diff is only whitespace/style.
⏺ Command(/bin/zsh -lc 'rustfmt src/bootstrap/llm_policy_fixture/fixture.rs')
⏺ The formatter finished cleanly. I’m checking the exact diff now so I can confirm it only normalized layout and didn’t alter content.
⏺ Command(/bin/zsh -lc "sed -n '1,120p' src/bootstrap/llm_policy_fixture/fixture.rs")
⏺ Command(/bin/zsh -lc 'git diff -- src/bootstrap/llm_policy_fixture/fixture.rs')
⏺ `src/bootstrap/llm_policy_fixture/fixture.rs` is formatted now.

I ran `rustfmt` on the file, which normalized the struct/function layout:

- added standard spacing and indentation
- expanded the inline definitions into conventional multi-line Rust formatting

I didn’t run tests because this was a formatting-only change.
