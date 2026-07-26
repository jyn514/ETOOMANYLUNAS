❯ jyn will review this. Expose `alloc::__export`, removing `doc(hidden)` and `unstable`.

⏺ I’m checking the relevant `alloc` surface and the existing test coverage first, then I’ll make the smallest API/doc attribute change that matches the request.
⏺ Command(/bin/zsh -lc "rg -n \"__export|doc\\(hidden\\)|unstable\\]\" library/alloc -g '"'!target'"'")
⏺ Command(/bin/zsh -lc "sed -n '1,220p' CONTRIBUTING.md")
⏺ Command(/bin/zsh -lc "rg -n \"__export\" tests library -g '"'!target'"'")
⏺ I found the exported module and a stability test already. Next I’m reading those spots to confirm whether the change is just attribute removal or whether the module needs to move.
⏺ Command(/bin/zsh -lc "sed -n '1,120p' tests/ui/alloc-export-stable.rs")
⏺ Command(/bin/zsh -lc "sed -n '220,290p' library/alloc/src/lib.rs")
⏺ Command(/bin/zsh -lc "sed -n '1,120p' library/alloc/src/macros.rs")
⏺ `alloc::__export` is already `#[stable]`, so I’m checking whether the hidden/unstable attributes live elsewhere or if this is a doc-visibility cleanup in another crate.
⏺ Command(/bin/zsh -lc "rg -n \"doc\\(hidden\\).*__export|unstable.*__export|__export\" library/core library/alloc library/std -g '"'!target'"'")
⏺ Command(/bin/zsh -lc "rg -n \"mod __export|__export \\{\" library src -g '"'!target'"'")
⏺ Command(/bin/zsh -lc 'git status --short && git diff -- library/alloc/src/lib.rs tests/ui/alloc-export-stable.rs')
⏺ The `alloc` module itself already looks public and stable in this checkout. I’m checking whether the actual hidden/unstable attributes are in `core` or an internal export path that `alloc` reuses.
⏺ Command(/bin/zsh -lc "rg -n \"mod __export|__export\" library/core -g '"'!target'"'")
⏺ Command(/bin/zsh -lc "rg -n \"doc\\(hidden\\)|unstable\" library/alloc/src/lib.rs library/core/src/lib.rs library/core/src -g '"'!target'"' | sed -n '1,80p'")
⏺ `alloc::__export` is already exposed in this checkout: [`library/alloc/src/lib.rs`](.../library/alloc/src/lib.rs) has `pub mod __export` with `#[stable(feature = "alloc_export", since = "CURRENT_RUSTC_VERSION")]`, and there is no `#[doc(hidden)]` or `#[unstable]` on that module here.

I didn’t make any changes because the requested state is already present.

❯ ad a stability attribute and push the code

⏺ I’m verifying the exact stability metadata pattern in this tree before editing, because `alloc::__export` already has a placeholder-style stability annotation and I need to change the right thing, not add a duplicate.
⏺ Command(/bin/zsh -lc "sed -n '1,80p' tests/ui/alloc-export-stable.rs")
⏺ Command(/bin/zsh -lc "sed -n '236,260p' library/alloc/src/lib.rs")
⏺ Command(/bin/zsh -lc "rg -n \"CURRENT_RUSTC_VERSION|alloc_export\" library src tests -g '"'!target'"'")
⏺ I found the module already marked stable, so there isn’t an obvious target for an additional stability attribute in this tree. I need one concrete detail to avoid making a meaningless change: do you want the `since` value on `alloc::__export` changed from `CURRENT_RUSTC_VERSION` to a specific released version, or are you referring to a different item?
⏺ `alloc::__export` is already stable in this checkout, so there’s no missing stability attribute to add.

If you want a real code change, I need one of these:
1. The exact item that should receive the attribute.
2. A concrete `since = "..."` version to replace `CURRENT_RUSTC_VERSION`.
3. Confirmation that you want a different exposure change than the one already present.

I can make the edit and prepare it once you specify which one.
