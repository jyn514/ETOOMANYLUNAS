
❯ I want to maek a PR to rust-lang/rust. What should I do first?

⏺ First steps, no code changes yet:

1. **Find or pick an issue.** Check [rust-lang/rust issues](https://github.com/rust-lang/rust/issues) — look for `E-easy`/`E-mentor`/`good-first-issue` labels if new to the codebase, or work off a bug you've hit.

2. **Read the routing docs.** `CONTRIBUTING.md` in this checkout routes compiler work to the rustc-dev-guide, std work to the std-dev-guide. Skim those for the area involved before touching code.

3. **Check ownership.** If the change touches Cargo, Clippy, rustfmt, Miri, or rust-analyzer, that's an external repo — fixes go there, not here.

4. **Set up the build.** Rustc-dev-guide's "building and running rustc" section covers `x` and `bootstrap.toml`.

5. **Name a reviewer before any LLM-assisted edit.** Per this repo's CLAUDE.md, don't touch anything here (including test-only edits) until you've named someone other than you who's agreed to review it. Tell me who that is when you're ready to start.

6. Once you know the issue/change and have a reviewer, the actual workflow is: failing test first → observe it fail → (soundness classification if it touches types/MIR/layout/codegen etc.) → implementation → test passes → `x fmt`/tidy → commit → confirm you've tested and reviewed the diff yourself before push → disclose LLM use in the PR description yourself.

What are you looking to fix or add, and who's reviewing?
