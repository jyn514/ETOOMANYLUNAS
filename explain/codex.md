❯ what is rustc_mir_transform doing? why does it exist?

⏺ `rustc_mir_transform` is the part of the compiler that runs transformation passes over MIR, the compiler’s mid-level IR. It exists to simplify, clean up, and optimize MIR after `rustc_mir_build` produces it and before later stages like borrow checking and codegen use it.

High level, it sits in the pipeline to:
- normalize MIR into a form that is easier for later passes to reason about
- remove dead or redundant operations
- perform MIR-level optimizations and canonicalizations
- prepare the body for borrowck and backend consumption

What have you already tried, and where have you looked?

If you want a starting point, look at:
- `compiler/rustc_mir_build/`
- `compiler/rustc_mir_transform/`
- the MIR chapters in `src/doc/rustc-dev-guide/` especially the lowering and MIR optimization docs.
⏺ `rustc_mir_transform` is the compiler crate that runs transformation passes over MIR, Rust’s mid-level IR. It exists to clean up, normalize, and optimize MIR after `rustc_mir_build` produces it and before later consumers like borrow checking and codegen use it.

At a high level, it is there to:
- make MIR simpler and more regular
- remove dead or redundant operations
- apply MIR-level optimizations and canonicalizations
- prepare bodies for later compiler stages

What have you already tried, and where have you looked?

Good starting points:
- `compiler/rustc_mir_build/`
- `compiler/rustc_mir_transform/`
- the MIR sections in `src/doc/rustc-dev-guide/`

❯ what's going on in https://github.com/rust-lang/rust/issues/155538 ?

⏺ I’m reading the issue itself first, then I’ll summarize only what it says and point you to the right area. After that, I need to know what you’ve already tried and where you looked.
⏺ WebSearch
⏺ The issue says this is an ICE on a variant of `#150508`. The core pattern is:

- A trait `Apply` has an associated type `Output<T: Trait>: Trait`.
- `Identity` implements `Apply` by mapping `Output<T> = T`.
- `Thing<A>` implements `Trait` only if `<A as Apply>::Output<Self>: Trait`.
- A function returns `impl Trait` by constructing `Thing(x)`.
- `main` then coerces `Box::new(weird(Identity))` to `Box<dyn Trait>`.

What the reporter says is happening:
- Each trait bound looks OK before monomorphization.
- After monomorphization, the required bound becomes `Thing<Identity>: Trait`.
- Proving that bound causes an inductive cycle.
- The compiler then ICEs during MIR validation on an unsizing coercion from `Box<Thing<Identity>>` to `Box<dyn Trait>`.

The backtrace points into:
- `rustc_mir_transform::validate`
- `rustc_mir_transform::optimized_mir`
- monomorphization / instance MIR collection

So, at a high level, this looks like a bad interaction between `impl Trait`, trait-object coercion, and a cyclic trait obligation that survives into MIR validation and gets caught as broken MIR.

What have you already tried, and where have you looked?

Likely starting points:
- `compiler/rustc_mir_transform/`
- `compiler/rustc_monomorphize/`
- the areas for coercions, `dyn Trait`, and `impl Trait` in the compiler
- the issue’s linked predecessor `#150508`
