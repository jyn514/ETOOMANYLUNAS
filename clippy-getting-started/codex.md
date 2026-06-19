❯ i want to fix a bug in clippy itself. what should i do first?

⏺ What have you already tried, and where have you looked?

First step is to narrow the bug to a single lint or tool path, then find its implementation and tests. For Clippy that usually means:
- `src/tools/clippy/clippy_lints/src/`
- `src/tools/clippy/tests/`
- the Clippy book / lint docs
- Zulip `#clippy` if you need design context

If this is a Clippy-tool bug rather than a rustc bug, the right repo is usually Clippy’s own repository, not `rust-lang/rust`. If you already have an error message, test name, or file path, paste it and I’ll point you at the next place to inspect.
⏺ What have you already tried, and where have you looked?

First step is to narrow the bug to a single lint or tool path, then find its implementation and tests. For Clippy that usually means:
- `src/tools/clippy/clippy_lints/src/`
- `src/tools/clippy/tests/`
- the Clippy book or lint docs
- Zulip `#clippy` if you need design context

If this is a Clippy-tool bug rather than a rustc bug, the right repo is usually Clippy’s own repository, not `rust-lang/rust`. If you already have an error message, test name, or file path, paste it and I’ll point you at the next place to inspect.
