❯ i want to fix a bug in clippy itself. what should i do first?

⏺ First, confirm the bug is actually in Clippy and not in rustc or the test setup.

Then do this, in order:

1. Reproduce it with the smallest possible input.
2. Find the exact lint or pass involved.
3. Write a test that fails first.
4. Only then change the implementation.
5. Re-run the same test and a focused Clippy test subset.

Because this is a Rust repo, there are two important gates before any code edit:
- I need a named reviewer from the Rust project before I can make repository changes.
- If the bug lives under `src/tools/clippy`, that code is owned by the Clippy project, so we should verify ownership before editing here.

If you want, I can help you narrow the bug down to the specific lint and test file first.
