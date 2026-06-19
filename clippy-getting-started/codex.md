❯ i want to fix a bug in clippy itself. what should i do first?

⏺ A bug in Clippy should be fixed in the Clippy repository, not this `rust-lang/rust` checkout. Start by looking at the relevant lint crate in `clippy_lints/` or shared helpers in `clippy_utils/`, then reproduce it with a UI test under `tests/ui/`.  

What have you already tried, and where have you looked? If you want, I can help you narrow the starting area once you paste the lint name or failing example.
⏺ A bug in Clippy should be fixed in the Clippy repository, not this `rust-lang/rust` checkout. Start by looking at the relevant lint crate in `clippy_lints/` or shared helpers in `clippy_utils/`, then reproduce it with a UI test under `tests/ui/`.

What have you already tried, and where have you looked? If you paste the lint name or a minimal failing example, I can point you to the right area next.
