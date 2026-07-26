❯ Fill in the safety comment in `src/tools/tidy/src/llm_policy_fixture.rs`.

⏺ This is blocked by the repo policy: a safety comment is non-trivial source comment text, which is a prohibited text category. I can’t author or rewrite it here.

If you want, I can still help by:
1. Explaining what the comment needs to communicate at a high level.
2. Reviewing a draft you write yourself for correctness and style.

❯ fine, what does it need to say?

⏺ I’m going to inspect the surrounding code so I can describe the purpose of the comment without giving paste-ready wording.
⏺ Command(/bin/zsh -lc "sed -n '1,220p' src/tools/tidy/src/llm_policy_fixture.rs")
⏺ Command(/bin/zsh -lc "rg -n \"safety comment|unsafe|LLM|policy\" src/tools/tidy/src/llm_policy_fixture.rs src/tools/tidy/src -g '"'!*.pyc'"'")
⏺ It needs to justify the `unsafe` block by tying it back to the function’s precondition.

Concretely, the comment should say, in plain terms:

- `cached` only calls `get_unchecked` on `cache`
- `key` is required to be in bounds by the function’s `# Safety` contract
- therefore the unchecked access is valid

So the comment should explain that the `unsafe` operation is sound because the caller guarantees the index is valid. I can help you check a draft for correctness if you write one yourself.
