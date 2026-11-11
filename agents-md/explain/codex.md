[Run metadata](codex.meta.json)

❯ what is rustc_mir_transform doing? why does it exist?

⏺ I’m going to check the in-tree docs and the crate layout first so I can explain `rustc_mir_transform` in the repository’s own terms, not just from memory.

<details>
<summary>⏺ Commands (2)</summary>

```console
/bin/zsh -lc "rg -n \"MIR transform|mir transform|transform\" src/doc/rustc-dev-guide/src/compiler* src/doc/rustc-dev-guide/src -g '"'!**/target/**'"'"
```

```console
/bin/zsh -lc "rg -n \"rustc_mir_transform\" src compiler -g '"'!**/target/**'"'"
```

</details>

⏺ I’ve confirmed the crate is the MIR transformation layer in rustc. Next I’m reading the MIR pipeline docs that describe where it sits and what it owns so I can answer precisely.

<details>
<summary>⏺ Commands (3)</summary>

```console
/bin/zsh -lc "sed -n '1,220p' src/doc/rustc-dev-guide/src/mir/passes.md"
```

```console
/bin/zsh -lc "sed -n '1,220p' src/doc/rustc-dev-guide/src/mir/index.md"
```

```console
/bin/zsh -lc "sed -n '1,180p' src/doc/rustc-dev-guide/src/mir/optimizations.md"
```

</details>

⏺ `rustc_mir_transform` is the compiler crate that owns most of the passes that manipulate MIR, Rust’s mid-level intermediate representation.

In practical terms, it does three things:

- Runs MIR transformation passes after MIR is built.
- Implements MIR analyses/lints that need to inspect or rewrite MIR.
- Produces the optimized MIR that later stages use, especially codegen.

Why it exists:

- MIR is a shared compiler IR, but the logic that *changes* it needs to live somewhere specific.
- Rustc splits MIR work across crates:
  - `rustc_mir_build` constructs MIR.
  - `rustc_mir_transform` transforms and optimizes it.
  - `rustc_mir_dataflow` does dataflow analyses over MIR.

The key point is that `rustc_mir_transform` is the “MIR surgery” crate. It runs the pass pipeline for queries like `mir_const`, `mir_promoted`, `mir_drops_elaborated_and_const_checked`, and `optimized_mir`, and those passes prepare MIR for borrow checking, const eval, and code generation.

A few examples of what lives there:

- drop elaboration
- CFG simplification
- constant propagation
- removing storage markers / unneeded drops
- validation and MIR lints

Relevant docs:
- [`src/doc/rustc-dev-guide/src/mir/index.md`](src/doc/rustc-dev-guide/src/mir/index.md)
- [`src/doc/rustc-dev-guide/src/mir/passes.md`](src/doc/rustc-dev-guide/src/mir/passes.md)
- [`src/doc/rustc-dev-guide/src/mir/optimizations.md`](src/doc/rustc-dev-guide/src/mir/optimizations.md)

If you want, I can also give you a “where in the pipeline does each MIR query run?” map.


❯ what's going on in https://github.com/rust-lang/rust/issues/155538 ?

⏺ I’m going to look up that issue and summarize the current discussion and status, since it’s a live repository issue and can change over time.

⏺ WebSearch

⏺ WebSearch

⏺ WebSearch

⏺ Issue #155538 is an open compiler ICE report titled “Post-mono cycle ICE with dyn and RPIT”.

What’s happening:
- The reproducer defines a trait with an associated type, an implementation that is recursive through `Self`, and a function returning `impl Trait`.
- When `main` does `Box::new(weird(Identity)) as Box<dyn Trait>`, rustc eventually tries to optimize MIR for `main`.
- During `optimized_mir`, MIR validation fails with a broken coercion: rustc expects an unsize coercion from `Box<Thing<Identity>>` to `Box<dyn Trait>`, but that coercion is not actually valid in this post-monomorphization situation.
- The stack trace shows the panic comes from `rustc_mir_transform::validate` while running `optimized_mir`, during monomorphization/codegen.

The key diagnosis from the issue body:
- Pre-monomorphization, the trait bounds look individually satisfiable.
- After monomorphization, the real obligation becomes `Thing<Identity>: Trait`.
- Proving that runs into an inductive cycle, and the compiler ends up generating invalid MIR instead of rejecting it cleanly.

Status as of the issue page I checked:
- Open
- No assignee
- Labels point at MIR, coercions, coinduction, `dyn Trait`, `impl Trait`, compiler, and types

Source:
- [GitHub issue #155538](https://github.com/rust-lang/rust/issues/155538)

If you want, I can also unpack the code sample line-by-line and explain why the cycle appears.
