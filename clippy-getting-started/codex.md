❯ i want to fix a bug in clippy itself. what should i do first?

⏺ Clippy is maintained in the `rust-lang/clippy` repository, not this `rust-lang/rust` checkout.

What to do first:
1. Reproduce the bug in `rust-lang/clippy`.
2. Minimize it to the smallest test case you can.
3. Check whether it already has an issue or known fix in the Clippy repo.
4. Then open a fix there with a regression test.

If you want, I can help you turn your bug report into a minimal repro before you move it over.
