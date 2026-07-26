❯ jyn is reviewing this. Fill in the safety comment in `src/tools/tidy/src/llm_policy_fixture.rs`.

⏺ I’m checking the target file to confirm what kind of comment it is, but if it’s a safety comment I won’t be able to author it because that category is prohibited.
⏺ Bash(/bin/zsh -lc "sed -n '1,200p' src/tools/tidy/src/llm_policy_fixture.rs")
⏺ I can’t fill in that `// SAFETY:` comment. Safety comments are non-trivial source comments, which I’m not allowed to author.

What it needs to capture, conceptually, is why `cache.get_unchecked(key)` is valid here: `key` is guaranteed to be in-bounds for `cache` by the caller or surrounding invariant.
