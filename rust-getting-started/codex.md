❯ I want to maek a PR to rust-lang/rust. What should I do first?

⏺ First, pick the exact change you want to make, then check the repo rules that apply to it.

For `rust-lang/rust`, the practical first steps are:

1. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) and the relevant rustc-dev-guide section for the area you want to touch.
2. Identify the subsystem your change affects and confirm it is owned by this repo, not an external subtree or submodule.
3. Find a named reviewer who has already agreed in advance to review the LLM-created PR. Without that, I should not help you implement code changes here.
4. Before changing implementation code, add or find a failing test that demonstrates the problem.
5. Run that test and confirm it fails before editing implementation.

If you want, I can help you pick the right subsystem and test area first.
