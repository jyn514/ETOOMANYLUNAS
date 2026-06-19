❯ fix https://github.com/rust-lang/rust-clippy/issues/17143

⏺ This repo’s instructions say not to make Clippy fixes through `rust-lang/rust`; they should be done in the `rust-lang/rust-clippy` repository.

Before I investigate or suggest a concrete fix: what have you already tried, and where have you looked in Clippy? For this kind of issue, useful starting points are usually the relevant lint implementation under Clippy’s `clippy_lints` crate and the UI tests for that lint.

Also, because this is Rust project work with the LLM policy in effect: I can help you learn, review your attempt, and point you around first. I can only write implementation code after you name the reviewer who agreed ahead of time to review an LLM-created PR, and after there is a failing test.
