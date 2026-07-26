❯ i want to fix a bug in clippy itself. what should i do first?

⏺ If it’s a bug in Clippy itself, the first step is to work in the Clippy repository, not this `rust-lang/rust` checkout.

Use the owning repo for Clippy and start by:
1. Reproducing the bug with a minimal example.
2. Finding the relevant Clippy lint or pass.
3. Adding a regression test in Clippy’s own test suite.
4. Fixing the implementation in that repo.

If you want, I can help you narrow down the exact Clippy repo, test location, or likely lint once you share the bug report or repro.
