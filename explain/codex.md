❯ what is rustc_mir_transform doing? why does it exist?

⏺ `rustc_mir_transform` is the part of the compiler that runs MIR passes after MIR is built and before codegen, so it is the home for optimization and cleanup transforms on MIR rather than parsing/type checking or borrow checking.

What have you already tried, and where have you looked? If you want, I can point you to the main submodules to inspect first, like the pass entry points and a couple of representative transforms.
⏺ `rustc_mir_transform` is the crate for MIR passes that rewrite or optimize MIR after it has been built.

Why it exists:
- MIR construction and MIR transformation are separate stages.
- Keeping transforms in their own crate keeps the pipeline modular.
- It groups passes like simplification, optimization, and cleanup in one place before later stages such as borrow checking or codegen consume the MIR.

A useful way to think about it:
- `rustc_mir_build` makes MIR from HIR.
- `rustc_mir_transform` changes that MIR.
- later compiler phases use the transformed result.

What have you already tried, and where have you looked?

❯ what's going on in https://github.com/rust-lang/rust/issues/155538 ?

⏺ I’m pulling the issue and its linked context first so I can summarize the actual problem instead of guessing from the number alone.
⏺ WebSearch
⏺ WebSearch
⏺ WebSearch
⏺ WebSearch
⏺ WebSearch
⏺ The issue page itself isn’t fetchable through the browser cache here, so I’m checking the repository for any mention of the issue number or linked tracking context.
⏺ Bash(/bin/zsh -lc 'rg -n "155538" .')
⏺ Bash(/bin/zsh -lc 'git log --oneline --decorate -n 20 --grep=155538')
⏺ I didn’t find a local reference to the issue number, so I’m querying GitHub’s API directly for the title/body/comments.
⏺ Bash(/bin/zsh -lc 'curl -L --silent https://api.github.com/repos/rust-lang/rust/issues/155538')
⏺ I have the repro and the panic site; I’m checking the discussion thread now to see whether it’s a known duplicate, workaround, or a confirmed compiler bug in the cycle handling.
⏺ Bash(/bin/zsh -lc 'curl -L --silent https://api.github.com/repos/rust-lang/rust/issues/155538/comments')
⏺ It’s an ICE report about a trait-solving cycle that only shows up after monomorphization, not a user-facing type error.

What the issue shows:
- Minimal repro involves a trait with a generic associated type, an `impl Trait` return, and then coercing `Box::new(weird(Identity))` to `Box<dyn Trait>`.
- The compiler accepts the program far enough to reach MIR validation, then panics in `rustc_mir_transform::validate` while checking an `Unsize` coercion.
- The reported panic is basically: MIR says “coerce `Box<Thing<Identity>>` to `Box<dyn Trait>`”, but that coercion is not actually valid once the post-mono obligation is fully resolved.

What’s going on conceptually:
- Pre-monomorphization, the obligations look individually okay.
- After monomorphization, the needed bound becomes self-referential: `Thing<Identity>: Trait`.
- The thread says this hits an “unknown cycle” in trait search, not a successful inductive proof, so it should not become an unsoundness by itself.
- `lcnr` points out this is likely about `impossible_predicates` encountering an error path, rather than a sound trait-system hole.

Status from the thread:
- It’s labeled `I-ICE`, `A-MIR`, `A-impl-trait`, `A-dyn-trait`, and `regression-from-stable-to-stable`.
- Reporter says it regressed between 1.91.0 and 1.92.0.
- `matthiaskrgr` suggested it may be related to [#148094](https://github.com/rust-lang/rust/issues/148094), though the reporter disagreed that it is the same bug.
- A compiler team member assigned it `P-medium` and noted there was Zulip discussion.

Links:
- Issue: [rust-lang/rust#155538](https://github.com/rust-lang/rust/issues/155538)
- Comment explaining the cycle as “unknown” rather than inductive: [issue comment](https://github.com/rust-lang/rust/issues/155538#issuecomment-4326666390)
- Regression/bisect comment: [issue comment](https://github.com/rust-lang/rust/issues/155538#issuecomment-4277993288)

If you want, I can also trace the repro through the specific MIR/trait-solving path and explain why the validator is the thing that explodes instead of the coercion being rejected earlier.
