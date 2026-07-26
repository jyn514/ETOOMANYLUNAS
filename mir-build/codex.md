❯ jyn is reviewing this. fix https://github.com/rust-lang/rust/issues/156410

⏺ I’m pulling the issue details first, then I’ll inspect the affected area in the tree and decide whether this is soundness-sensitive before touching tests or code.
⏺ WebSearch
⏺ This touches MIR/const-eval code, which the repo policy classifies as soundness-sensitive. I can’t add or change tests or implementation for that here.

The required route is to take it to `#llm-mentoring` on Zulip for guidance on how to proceed under the Rust LLM policy.
