[Run metadata](claude.meta.json)

❯ what is rustc_mir_transform doing? why does it exist?

⏺ `rustc_mir_transform` is the crate that owns MIR-to-MIR optimization and lowering passes in rustc — it's the "middle end" that runs between MIR building and codegen.

## What it does

After MIR is built from THIR (in `rustc_mir_build`) and before it's handed to codegen (`rustc_codegen_ssa`/backends) or the const evaluator, MIR goes through a long pipeline of transformation passes defined in this crate. Broadly these fall into a few buckets:

- **Cleanup/canonicalization**: things like `SimplifyCfg`, `SimplifyLocals`, deaggregation of structs/enums, removing unwind edges where not needed, etc. Puts MIR into a normalized shape passes downstream can rely on.
- **Optimizations**: `ConstProp`/`GVN` (const/copy propagation, global value numbering), `Inline` (MIR inlining), `DeadStoreElimination`, `DestinationPropagation`, `JumpThreading`, `EarlyOtherwiseBranch`, `MatchBranchSimplification`, `RemoveUnneededDrops`, etc. These reduce IR size/cost before it reaches LLVM, and also make MIR-based analyses (and `-O0` codegen, which relies on MIR being reasonably good since it skips a lot of LLVM optimization) cheaper.
- **Lowering passes required for correctness**, not just speed:
  - `ElaborateDrops` — turns high-level `Drop` terminators into explicit drop-flag-guarded code.
  - `AddMovesForPackedDrops`, `AddRetag` (for Stacked/Tree Borrows under Miri), `CleanupPostBorrowck`.
  - Generator/coroutine state-machine transformation (`StateTransform`) — turns `async fn`/generators into an explicit state machine enum + `poll`/`resume` function.
  - Shim building for `Clone`, `FnPtr` calls, drop glue, etc.
- **Instrumentation**: coverage instrumentation (`InstrumentCoverage`), sanitizer-related passes.
- **Validation**: MIR well-formedness checks (`Validator`) that run in debug/`-Zvalidate-mir` builds to catch bugs in earlier passes.

The whole thing is orchestrated by `optimized_mir`/`mir_drops_elaborated_and_const_checked` query functions that run an ordered list of `MirPass`es, gated by optimization level and `-Z` flags.

## Why it exists as its own crate

- **Separation of concerns**: MIR building (syntax-directed, from HIR/THIR) is a very different job from MIR optimization (dataflow/CFG-based). Splitting them keeps `rustc_mir_build` focused on lowering and `rustc_mir_transform` focused on IR-to-IR rewriting, each with its own dependency footprint.
- **Compile-time layering**: rustc's crate graph is deliberately fine-grained so incremental rebuilds of the compiler itself are cheaper, and so lower-level crates (`rustc_middle`, `rustc_index`, `rustc_data_structures`) don't depend on transform logic.
- **Backend independence**: MIR optimizations benefit *every* backend (LLVM, Cranelift, GCC) and also `const`-eval/Miri, since they all consume the same optimized MIR. Keeping it separate from `rustc_codegen_ssa` means non-LLVM backends and the interpreter get these optimizations for free without linking codegen infrastructure.
- **MIR itself needs to be decent even unoptimized**: because Rust does a lot of monomorphization and relies on LLVM to clean up, but debug builds (`-O0`) skip LLVM optimization, MIR-level cleanup (drop elaboration, simplify-locals, etc.) matters for reasonable debug-build codegen time and output size — this is genuinely rustc_mir_transform's job, not "redundant with LLVM."

If you want, I can point to specific pass implementations or the pass-ordering list (`rustc_mir_transform::run_optimization_passes` / `optimized_mir` in `lib.rs`) in a checked-out rustc source tree — do you have one available locally, or do you want a general overview only?


❯ what's going on in https://github.com/rust-lang/rust/issues/155538 ?

<details>
<summary>⏺ ToolSearch</summary>

```json
{
  "query": "select:WebFetch",
  "max_results": 5
}
```

</details>

<details>
<summary>⏺ Commands (2)</summary>

```console
gh issue view 155538 --repo rust-lang/rust --comments
```

```console
gh issue view 155538 --repo rust-lang/rust
```

</details>

⏺ ## Summary: [rust-lang/rust#155538](https://github.com/rust-lang/rust/issues/155538) — "Post-mono cycle ICE with dyn and RPIT"

**What it is:** An internal compiler error (ICE), open, `P-medium`, tagged `T-types` + `T-compiler`, a stable-to-stable regression. It's a variant of #150508.

**Minimal repro (from the report):**
```rust
trait Apply {
    type Output<T: Trait>: Trait;
}
struct Identity;
impl Apply for Identity {
    type Output<T: Trait> = T;
}

struct Thing<A: Apply>(A);
trait Trait {}
impl<A: Apply> Trait for Thing<A> where <A as Apply>::Output<Self>: Trait {}
// effectively: impl Trait for Thing<Identity> where Thing<Identity>: Trait {}

fn weird<A: Apply>(x: A) -> impl Trait {
    Thing(x)
}

fn main() {
    let _ = Box::new(weird(Identity)) as Box<dyn Trait>;
}
```

**The mechanism:**
- Each individual trait bound is provable *before* monomorphization.
- After monomorphization (`A = Identity`), the required bound collapses to `Thing<Identity>: Trait`, whose own impl requires `Thing<Identity>: Trait` — i.e. it's circular.
- Trying to prove that bound hits what lcnr clarified is not an *inductive* cycle but an **unknown cycle** (see `rustc_middle::ty::search_graph::PathKind`) — meaning the solver bails out without erroring, so `impossible_predicates` doesn't flag the impl as unreachable/impossible.
- Because the impossibility isn't detected, monomorphization proceeds as if `Thing<Identity>: Trait` holds, and by the time MIR reaches the `-Zvalidate-mir` / codegen validator, the unsizing coercion `Box<Thing<Identity>>` → `Box<dyn Trait>` no longer type-checks, tripping `rustc_mir_transform::validate::CfgChecker` and producing a `span_bug` ("broken MIR ... Unsize coercion ... isn't coercible").
- Notably this ICEs under **both** the old and new trait solver (the referenced #150508 apparently didn't).

**Regression bisection:** narrowed to nightly-2025-10-16, but the bisection tooling couldn't pin an exact commit (no CI builds available in that window); one of ~7 candidate merged PRs (rust-analyzer sync, rollups, `union-ne-check`, `db-limit-extern-crate-usage`, cargo update, `prefer-alias-over-env-for-sizedness`) is the culprit but it's unconfirmed. `matthiaskrgr` initially guessed #148094 was related; `theemathas` disagreed.

**Status:** `lcnr` (trait-solver expert) diagnosed the root cause as `impossible_predicates` needing to treat this as an *error* rather than an unknown/ambiguous cycle so the impl gets correctly rejected as impossible pre-monomorphization. There's a linked Zulip discussion thread but no fix/PR yet — it's an open, diagnosed-but-unfixed soundness-adjacent hole in cycle handling for impossible predicates, not yet assigned to anyone.
