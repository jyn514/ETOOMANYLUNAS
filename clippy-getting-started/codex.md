❯ i want to fix a bug in clippy itself. what should i do first?

⏺ Clippy fixes should be made in the Clippy repo, not through `rust-lang/rust`.

First, check the issue or behavior against `rust-lang/rust-clippy`, then reproduce it with a small example. Clippy’s usual flow is to add or adjust a test under its UI test suite, confirm it fails, then make the lint or suggestion change.

A good first step:

1. Go to the Clippy repository: https://github.com/rust-lang/rust-clippy
2. Read its contributor docs, especially how to run UI tests.
3. Create the smallest Rust snippet that shows the bug.
4. Ask on Zulip if you are unsure where the lint lives: https://rust-lang.zulipchat.com/ — Clippy has project streams.

Because this repo has a strict LLM policy, before I investigate or give detailed code pointers: what have you already tried, and where have you looked so far?
