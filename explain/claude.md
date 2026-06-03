❯ what is rustc_mir_transform doing? why does it exist?

  Listed 1 directory (ctrl+o to expand)

⏺ MIR (Mid-level Intermediate Representation) is the compiler's representation of code after type-checking, before codegen.

  rustc_mir_transform is a pipeline of passes that run on MIR. Two categories:

  Correctness passes — things that must happen for correct code:
  - elaborate_drops — lowers Drop terminators into actual drop glue (calls destructors, handles panics)
  - lower_intrinsics — replaces intrinsic calls with MIR operations
  - promote_consts — extracts constant expressions into separate MIR bodies
  - coroutine — desugars async/generators into state machines
  - shim — generates synthetic MIR for things like FnPtr calls and vtable entries

  Optimization passes — things that make code faster/smaller:
  - gvn — global value numbering
  - inline — function inlining
  - copy_prop, dest_prop, dead_store_elimination, sroa
  - jump_threading, simplify_branches, unreachable_prop

  It exists because these transformations are easier on MIR than AST/HIR (SSA-like, explicit control flow, types already resolved) and simpler than LLVM IR (still
  Rust-level, can reason about ownership/drops).

  LLVM also runs its own optimization passes separately — rustc_mir_transform is the Rust-level optimization layer that runs first.

✻ Brewed for 12s

❯ what's going on in https://github.com/rust-lang/rust/issues/155538 ?

⏺ Bash(gh issue view 155538 --repo rust-lang/rust)
  ⎿  Error: Exit code 1
     Post "https://api.github.com/graphql": tls: failed to verify certificate: x509: OSStatus -26276

⏺ Fetch(https://github.com/rust-lang/rust/issues/155538)
  ⎿  Received 320.2KB (200 OK)

⏺ An ICE (internal compiler error) triggered by code combining dyn Trait with RPIT (return-position impl Trait).

  The trait bounds look valid before monomorphization, but after monomorphizing, proving Thing<Identity>: Trait creates an inductive cycle the compiler can't resolve — and
   instead of a graceful error, it panics during MIR validation.

  Open, P-medium, no fix yet. Likely needs someone on the types team to look at post-mono cycle detection.
