[Fixture](scenario.json) · [Run metadata](claude.meta.json)


❯ what is rustc_mir_transform doing? why does it exist?

⏺ `rustc_mir_transform` runs the pipeline of passes that rewrite MIR after building it from HIR, before codegen.

**What it does:**
- Owns the pass manager (`run_analysis_to_runtime_passes` / `mir_drops_elaborated_and_const_checked` / `optimized_mir` queries) that threads a function's MIR through an ordered list of transforms.
- Each pass is a `MirPass` impl: things like `SimplifyCfg`, `ConstProp`/`GVN`, `Inline`, `CopyProp`, `DeadStoreElimination`, `RemoveUnneededDrops`, `ElaborateDrops`, `AddMovesForPackedDrops`, `CleanupPostBorrowck`, generator/coroutine state-machine lowering, etc.
- Splits into stages: "analysis" MIR (mostly identity-ish, used for borrowck/const-eval), and "runtime"/optimized MIR (drop elaboration applied, optimizations applied) used for codegen.
- Handles drop elaboration — turning high-level `Drop` terminators into explicit conditional drop-flag logic — which is required for correctness, not just perf.
- Does inlining, dataflow-based optimizations, and dead-code cleanup to shrink/speed up codegen output.

**Why it exists as a separate crate:**
- Keeps MIR *construction* (`rustc_mir_build`) and MIR *consumption* (borrowck, codegen) decoupled from the large, evolving set of MIR-to-MIR rewrites.
- Lets the pass pipeline be queried/cached independently and reused by multiple consumers (const eval, codegen, Miri via the query system) without recompiling MIR-building logic.
- Because several of its passes (drop elaboration, layout-sensitive const-prop, generator lowering) affect generated code and validity, this crate sits in the soundness-sensitive category per this repo's CLAUDE.md — changes here need real scrutiny, not just mechanical review.

This is read-only explanation, no repo changes involved.

❯ what's going on in https://github.com/rust-lang/rust/issues/155538 ?

<details>
<summary>⏺ Command</summary>

```console
gh issue view 155538 --repo rust-lang/rust --comments 2>&1 | head -200
```

</details>

<details>
<summary>⏺ ToolSearch</summary>

```json
{
  "query": "select:WebFetch",
  "max_results": 1
}
```

</details>

<details>
<summary>⏺ WebFetch</summary>

```json
{
  "url": "https://github.com/rust-lang/rust/issues/155538",
  "prompt": "Summarize this issue: title, description, labels, current status, and key discussion points in comments."
}
```

</details>

⏺ Issue #155538 — **"Post-mono cycle ICE with dyn and RPIT"**, open.

- **What breaks:** combining `dyn Trait` objects with return-position `impl Trait` (RPIT) crashes the compiler during monomorphization. It's flagged as a variant of #150508.
- **Root cause:** trait bounds check out fine pre-monomorphization, but once monomorphized, proving `Thing<Identity>: Trait` produces an inductive cycle. That cycle causes the compiler to emit invalid MIR — the reported ICE message is roughly `Unsize coercion, but Box<Thing<Identity>> isn't coercible to Box<dyn Trait>`.
- **Reproduces on both trait solvers** (old and new), on nightly 1.97.0 (2026-04-18).
- **Touches:** MIR validation/transformation (this is where `rustc_mir_transform`-adjacent code notices the invalid coercion), trait-object/vtable layout, unsizing coercions, RPIT lowering, and coinduction for auto traits.

This is a compiler-internals correctness bug (ICE from an unsound-looking coercion check), not something fixable by casual patching — falls in the soundness-sensitive territory (type/trait resolution + MIR) per this repo's policy. If you want to work on it, that'd need a named reviewer and would go through the Soundness gate (test-only work first) before any implementation.
