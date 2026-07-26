❯ what is rustc_mir_transform doing? why does it exist?

⏺ I’m going to check the in-tree Rust compiler docs and the `rustc_mir_transform` crate itself so I can answer from the repository’s current structure rather than guessing.
⏺ Bash(/bin/zsh -lc 'rg -n "rustc_mir_transform" -S src compiler crates | head -n 50')
⏺ Bash(/bin/zsh -lc 'rg -n "MIR transform|mir transform|transform MIR|rustc_mir_transform" src/doc/rustc-dev-guide src/compiler src/tools -S | head -n 80')
⏺ I’ve confirmed this is the MIR transformation crate used by the compiler, not a separate tool. Next I’m reading the dev-guide sections that describe where it sits in the MIR pipeline and what kinds of passes live there.
⏺ Bash(/bin/zsh -lc "sed -n '1,140p' src/doc/rustc-dev-guide/src/mir/passes.md")
⏺ Bash(/bin/zsh -lc "sed -n '1,140p' src/doc/rustc-dev-guide/src/mir/optimizations.md")
⏺ Bash(/bin/zsh -lc "sed -n '430,470p' src/doc/rustc-dev-guide/src/overview.md")
⏺ `rustc_mir_transform` is the compiler crate that owns most MIR passes: cleanup passes, lints, analyses, and optimizations that run on MIR before codegen.

Why it exists:
- MIR is the compiler’s mid-level IR, and this crate is where rustc rewrites it in place after it has been built.
- It gives rustc a dedicated place to run the MIR pipeline stages such as `mir_built`, `mir_const`, `mir_promoted`, `mir_drops_elaborated_and_const_checked`, and `optimized_mir`.
- It centralizes MIR transformations so later compiler phases see a simpler, validated, and often faster-to-codegen representation.

In practice, it is the home for passes like `CleanupPostBorrowck`, `RemoveStorageMarkers`, `SimplifyCfg`, and `ConstProp`. The dev guide describes these as MIR passes implemented mostly in [`compiler/rustc_mir_transform/src`](src/doc/rustc-dev-guide/src/mir/passes.md) and run through [`optimized_mir`](src/doc/rustc-dev-guide/src/mir/optimizations.md).

Short version:
- `rustc_mir_build` constructs MIR.
- `rustc_mir_transform` transforms and optimizes MIR.
- `rustc_borrowck` checks MIR.
- codegen consumes the final optimized MIR.

Relevant docs:
- [`src/doc/rustc-dev-guide/src/mir/passes.md`](src/doc/rustc-dev-guide/src/mir/passes.md)
- [`src/doc/rustc-dev-guide/src/mir/optimizations.md`](src/doc/rustc-dev-guide/src/mir/optimizations.md)
- [`src/doc/rustc-dev-guide/src/overview.md`](src/doc/rustc-dev-guide/src/overview.md)

If you want, I can also walk through the exact MIR pipeline query-by-query.

❯ what's going on in https://github.com/rust-lang/rust/issues/155538 ?

⏺ I’m going to open the issue and check the surrounding discussion so I can summarize what it’s about and what the current status is.
⏺ WebSearch
⏺ WebSearch
⏺ WebSearch
⏺ WebSearch
⏺ WebSearch
⏺ WebSearch
⏺ WebSearch
⏺ I’ve got the issue title from the surrounding compiler-triage notes. I’m checking the GitHub API directly now to see the body and current state so I can tell you what the issue is actually reporting.
⏺ Bash(/bin/zsh -lc "curl -L -H 'Accept: application/vnd.github+json' -H 'X-GitHub-Api-Version: 2026-03-10' https://api.github.com/repos/rust-lang/rust/issues/155538")
⏺ WebSearch
⏺ Bash(/bin/zsh -lc "curl -L -H 'Accept: application/vnd.github+json' -H 'X-GitHub-Api-Version: 2026-03-10' https://api.github.com/repos/rust-lang/rust/issues/155538/comments?per_page=100 | jq -r '.[] | \"#\\(.id) \\(.user.login): \\(.body | gsub(\"\\n\"; \" \") | .[0:500])\"'")
⏺ I have the issue body now. I’m checking a few comments to see whether the thread found a root cause or whether it’s still an open ICE report.
⏺ Bash(/bin/zsh -lc "curl -L -H 'Accept: application/vnd.github+json' -H 'X-GitHub-Api-Version: 2026-03-10' 'https://api.github.com/repos/rust-lang/rust/issues/155538/comments?per_page=100' | jq -r '.[] | \"#\\(.id) \\(.user.login): \\(.body | gsub(\"\\n\"; \" \") | .[0:500])\"'")
⏺ It’s a compiler ICE report about a trait-solving / monomorphization edge case involving `dyn Trait` and `impl Trait` return types.

What the issue shows:
- A small program defines a generic `Apply` trait, an `Identity` implementation, and a `weird` function returning `impl Trait`.
- The program tries to coerce `Box::new(weird(Identity))` to `Box<dyn Trait>`.
- Rustc hits an internal compiler error while validating optimized MIR for `main`, specifically in [`rustc_mir_transform::validate`](https://github.com/rust-lang/rust/issues/155538) during the `optimized_mir` query.
- The validation error says the compiler produced an unsized coercion that is not actually valid: `Box<Thing<Identity>>` is not coercible to `Box<dyn Trait>`.

Why it happens:
- The bound required to make the coercion work becomes self-referential after monomorphization.
- The issue body says each individual trait bound looks fine before monomorphization, but after monomorphization the required bound is effectively `Thing<Identity>: Trait`, and proving that triggers a cycle.
- In the comments, `lcnr` clarifies that this is an “unknown” cycle, not an inductive one, which is why it does not appear to be unsound. The likely failure mode is that `impossible_predicates` should have reported an error instead of the compiler reaching this ICE.

Current status:
- It is still open.
- Triage assigned it `P-medium`.
- The latest compiler-team discussion I found treats it as a MIR / trait-solving bug, not an obvious soundness hole.

Useful links:
- Issue: [rust-lang/rust#155538](https://github.com/rust-lang/rust/issues/155538)
- Triage note mentioning it: [T-compiler agenda](https://hackmd.io/%40rust-compiler-team/SyjjLsgRWe)
- Comment saying it’s an “unknown” cycle, not an inductive one: [lcnr’s comment](https://github.com/rust-lang/rust/issues/155538#issuecomment-4326666390)

If you want, I can also break down the example code line by line and explain why the trait obligation becomes cyclic.
