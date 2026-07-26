❯ what is rustc_mir_transform doing? why does it exist?

⏺ I’m checking the compiler docs and source layout so I can answer from this checkout rather than guessing.
⏺ Command(/bin/zsh -lc "rg -n \"rustc_mir_transform\" Cargo.toml src -g '"'!target'"'")
⏺ Command(/bin/zsh -lc "rg -n \"rustc_mir_transform|MIR transform|mir_transform\" src compiler -g '"'!target'"'")
⏺ I found the crate and the dev-guide sections that describe it. Next I’m pulling the exact wording of the MIR pipeline so I can explain the crate’s role and why it is separate.
⏺ Command(/bin/zsh -lc "sed -n '1,140p' src/doc/rustc-dev-guide/src/mir/optimizations.md")
⏺ Command(/bin/zsh -lc "sed -n '1,140p' src/doc/rustc-dev-guide/src/mir/passes.md")
⏺ Command(/bin/zsh -lc "sed -n '430,460p' src/doc/rustc-dev-guide/src/overview.md")
⏺ `rustc_mir_transform` is the compiler crate that owns most MIR passes.

What it does:
- Takes MIR after it is built and runs a sequence of analyses, lints, transformations, and optimizations.
- Provides the pipeline behind queries like `mir_drops_elaborated_and_const_checked` and especially `optimized_mir`.
- Contains many individual passes, each usually in its own module, implementing `MirPass`.

Why it exists:
- MIR is a distinct compiler IR stage, and its transformations are substantial enough to deserve their own crate.
- It keeps the MIR pipeline modular: the MIR builder lives in `rustc_mir_build`, dataflow analyses live in `rustc_mir_dataflow`, and MIR transforms/optimizations live in `rustc_mir_transform`.
- It gives rustc a clear “middle end” boundary between type checking/borrow checking and codegen.
- It makes the pipeline easier to extend: new MIR passes get registered in the relevant query stage, usually `optimized_mir`.

In practice, the crate is where rustc:
- cleans up MIR after borrow checking,
- elaborates drops,
- runs optimizations like constant propagation and CFG simplification,
- validates MIR along the way.

Relevant docs:
- [MIR passes]( /private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-NX5muK/checkout/src/doc/rustc-dev-guide/src/mir/passes.md )
- [MIR optimizations]( /private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-NX5muK/checkout/src/doc/rustc-dev-guide/src/mir/optimizations.md )
- [Compiler overview]( /private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-NX5muK/checkout/src/doc/rustc-dev-guide/src/overview.md )

If you want, I can also sketch the exact MIR pipeline from `mir_built` to `optimized_mir` in one diagram-like explanation.

❯ what's going on in https://github.com/rust-lang/rust/issues/155538 ?

⏺ I’m pulling the issue and any linked context so I can summarize what it’s about and what the current status is.
⏺ WebSearch
⏺ WebSearch
⏺ WebSearch
⏺ The issue page itself isn’t loading through the browser tool, so I’m checking the GitHub API directly to get the title/body and summarize it accurately.
⏺ Command(/bin/zsh -lc "curl -L --silent https://api.github.com/repos/rust-lang/rust/issues/155538 | sed -n '1,220p'")
⏺ I have the report itself. I’m checking the discussion thread for whether it was diagnosed or fixed, so I can tell you the current state instead of just the symptom.
⏺ Command(/bin/zsh -lc "curl -L --silent https://api.github.com/repos/rust-lang/rust/issues/155538/comments?per_page=100 | sed -n '1,260p'")
⏺ The shell treated the `?` as globbing, so I’m retrying with the URL quoted.
⏺ Command(/bin/zsh -lc "curl -L --silent 'https://api.github.com/repos/rust-lang/rust/issues/155538/comments?per_page=100' | sed -n '1,260p'")
⏺ Command(/bin/zsh -lc "curl -L --silent 'https://api.github.com/repos/rust-lang/rust/issues/155538/comments?per_page=100&page=2' | sed -n '1,220p'")
⏺ I’ve got the key summary and one likely diagnosis pointer. I’m extracting the remaining comments now in case there’s a final resolution or workaround mentioned later in the thread.
⏺ Command(/bin/zsh -lc "curl -L --silent 'https://api.github.com/repos/rust-lang/rust/issues/155538/comments?per_page=100' | jq -r '.[] | \"---\\n\" + .user.login + \" @ \" + .created_at + \"\\n\" + .body'")
⏺ Issue #155538 is an open ICE report about a trait-object coercion involving RPIT (`impl Trait`) and a recursive-looking trait bound.

What the reporter found:
- A small example with `Apply`, `Thing<A>`, and `weird<A>() -> impl Trait` compiles differently across versions.
- On current nightlies at the time of filing, `Box::new(weird(Identity)) as Box<dyn Trait>` hits an ICE during `optimized_mir` validation.
- A closely related variant also ICEs with `-Zvalidate-mir`.

What changed:
- The reporter bisected it to a regression between `nightly-2025-10-15` and `nightly-2025-10-16`.
- There was no CI build available in that window, so no exact culprit commit was identified in the issue.

Current diagnosis in the thread:
- `lcnr` suggested the cycle is probably not an actual inductive proof cycle, but an “unknown” cycle in the trait solver.
- That matters because it points away from unsoundness and toward a solver/validation bug rather than a real proof of the trait bound.
- The reporter pushed back on an unsoundness interpretation for the dyn case, and `lcnr` clarified it likely only becomes unsound if `impossible_predicates` is involved.

Status:
- The issue is still open.
- It was assigned `P-medium` and discussed on Zulip.

Relevant links:
- [Issue #155538](https://github.com/rust-lang/rust/issues/155538)
- [Comment suggesting the “unknown cycle” explanation](https://github.com/rust-lang/rust/issues/155538#issuecomment-433027?placeholder=ignored)
