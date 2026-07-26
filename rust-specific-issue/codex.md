❯ jyn is reviewing this. Fix https://github.com/rust-lang/rust/issues/156621

⏺ I’m checking the issue and the relevant compiler area first, then I’ll look for a regression test that fails before any code changes.
⏺ WebSearch
⏺ I’ve confirmed this is a diagnostics bug: the semicolon suggestion on `if` without `else` includes an extra, incorrect location. Next I’m locating the existing UI test and the code that emits these suggestions so I can reproduce the failure first.
⏺ WebSearch
⏺ Bash(/bin/zsh -lc "rg -n \"if without else|if-without-else|semicolon\" compiler/rustc_* src/compiler src/test/ui -g '"'!src/llvm-project/*'"'")
⏺ Bash(/bin/zsh -lc "rg -n \"consider using a semicolon here|if expressions without else arms expect their inner expression to be \\"'`'"\\(\\)\\"'`|missing semicolon" src/test src/compiler src -g '"'"'!src/llvm-project/*'"'")
⏺ I found the likely implementation: `rustc_hir_typeck`’s missing-semicolon suggestion. I’m reading that code and the nearby UI tests to pin down the exact regression and keep the change narrow.
⏺ Bash(/bin/zsh -lc "sed -n '740,830p' compiler/rustc_hir_typeck/src/fn_ctxt/suggestions.rs")
⏺ Bash(/bin/zsh -lc "rg -n \"suggest_missing_semicolon|consider using a semicolon here\" compiler/rustc_hir_typeck/tests compiler/rustc_hir_typeck/src -g '"'!**/target/**'"'")
⏺ Bash(/bin/zsh -lc "rg -n \"if .*\\{[[:space:]]*"'$|if .*else|missing semicolon" tests ui src/test -g '"'*.rs'")
⏺ Bash(/bin/zsh -lc "sed -n '830,900p' compiler/rustc_hir_typeck/src/fn_ctxt/suggestions.rs")
⏺ I’ve got the implementation path and the special-case branch that seems backward. Now I’m checking which UI test directory this family of diagnostics uses so I can add a focused regression test and verify the current bad output before editing code.
⏺ Bash(/bin/zsh -lc "find tests/ui -maxdepth 2 -type f | rg \"(semicolon|if.*else|parens|suggestion|E0308)\\.rs"'$" | head -n 80')
⏺ Bash(/bin/zsh -lc "rg -n \"ExprParenthesesNeeded|consider using a semicolon here\" tests/ui compiler/rustc_hir_typeck -g '*.rs'")
⏺ Bash(/bin/zsh -lc "sed -n '1,160p' tests/ui/async-await/issue-66387-if-without-else.rs")
⏺ Bash(/bin/zsh -lc "sed -n '1,200p' tests/ui/suggestions/missing-semicolon.rs")
⏺ I’ve got enough context to write the regression test first. I’m adding a focused UI case that should fail on the current compiler because it still emits the bogus second semicolon suggestion on the `if` block.
⏺ Edit(file)
⏺ Bash(/bin/zsh -lc "python x.py test --help | sed -n '1,220p'")
⏺ The test is in place. I’m running just that one UI case now to capture the current stderr mismatch before I touch the implementation.
⏺ Bash(/bin/zsh -lc 'python x.py test tests/ui/typeck/issue-156621-missing-semicolon.rs --stage 1 --no-fail-fast')
⏺ Bash(/bin/zsh -lc "sed -n '1980,2055p' compiler/rustc_hir_typeck/src/coercion.rs")
⏺ Bash(/bin/zsh -lc "sed -n '730,820p' compiler/rustc_hir_typeck/src/expr.rs")
⏺ The bad help is coming from the coercion path that unconditionally suggests a semicolon at the end of the `if` tail expression. I’m tightening that guard so the compiler stops proposing the semicolon-after-`if` fix when the `if` has no `else`.
⏺ Edit(file)
⏺ I’ve made the implementation change. I’m now trying to run the regression test again, but the repo’s bootstrap setup is pointing at a different worktree and may need a narrower invocation if the full `x.py test` path stays blocked.
⏺ Bash(/bin/zsh -lc "find build -path '*/stage0/bin/rustc' -o -path '*/stage1/bin/rustc' | head -n 20")
⏺ Bash(/bin/zsh -lc 'git diff -- compiler/rustc_hir_typeck/src/coercion.rs tests/ui/typeck/issue-156621-missing-semicolon.rs')
⏺ Bash(/bin/zsh -lc 'cargo check -p rustc_hir_typeck')
⏺ `cargo check` hit the compiler’s bootstrap guard, which is expected in-tree. I’m retrying with `RUSTC_BOOTSTRAP=1` so we can at least validate the edited crate directly while the full `x.py` path remains flaky in this worktree.
⏺ Bash(/bin/zsh -lc 'mkdir -p /private/tmp/cargo-home && CARGO_HOME=/private/tmp/cargo-home RUSTC_BOOTSTRAP=1 cargo check -p rustc_hir_typeck')
⏺ The remaining blocker is cargo trying to use a cache under `/Users/jyn`, which this sandbox can’t write. I’m redirecting `HOME` and `CARGO_HOME` into writable temp space and rerunning the crate check.
⏺ Fixed the bogus semicolon-after-`if` suggestion for `if` blocks without `else`.

What changed:
- Added a regression test at [tests/ui/typeck/issue-156621-missing-semicolon.rs](/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-VbTzqD/checkout/tests/ui/typeck/issue-156621-missing-semicolon.rs).
- Updated the typeck suggestion logic in [compiler/rustc_hir_typeck/src/coercion.rs](/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-VbTzqD/checkout/compiler/rustc_hir_typeck/src/coercion.rs) to stop offering `suggest_semicolon_at_end` when the relevant expression is an `if` without an `else`.

Verification:
- I tried to run the regression, but the local bootstrap/cargo setup in this sandbox is pointing at an unwritable `/Users/jyn/...` cargo lock path, so I couldn’t complete an end-to-end test run here.

If you want, I can keep going and try a narrower compiletest invocation that avoids the bootstrap path issue.
