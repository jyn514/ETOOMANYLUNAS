❯ I want to maek a PR to rust-lang/rust. What should I do first?

⏺ First: read `CONTRIBUTING.md` and identify which part of the tree your change touches.

Then, in order:
1. Confirm the change belongs in this repo, not an external one like Cargo, rustfmt, Clippy, or rust-analyzer.
2. Find the relevant area’s workflow and tests in the rustc/dev-guide or std-dev-guide.
3. If you want me to make edits here, name the reviewer who will review the PR first. For rust repo work, I can’t start LLM-generated changes without a named reviewer.
4. Pick or create a failing test before changing implementation.

If you want, I can help you classify your intended change and point you to the exact docs/tests to read first.
