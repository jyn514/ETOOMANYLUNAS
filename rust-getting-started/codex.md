❯ I want to maek a PR to rust-lang/rust. What should I do first?

⏺ What have you already tried, and where have you looked?

Start by narrowing the change to one area of the tree:
- `compiler/` if this is a compiler bug or diagnostic
- `library/` if it is a std/libcore/alloc behavior change
- `tests/ui/` if you already have a repro and need a regression test
- `src/doc/rustc-dev-guide/` if you need process or architecture context

For a PR to `rust-lang/rust`, the usual first concrete step is to reproduce the problem and find the smallest failing test. After that, you can trace to the relevant module and decide whether the fix is safe to make.

If you tell me the issue you want to work on, I can point you to the right starting directory and test area.
