❯ i want to fix a bug in clippy itself. what should i do first?

⏺ Clippy is maintained externally (rust-lang/rust-clippy), even though it's mirrored via subtree into this repo under `src/tools/clippy`.

Per this repo's rules: editing clippy source in this checkout is banned. First step is routing to the right place, not fixing it here.

What to do:

1. File/find the issue at `rust-lang/rust-clippy` on GitHub.
2. Clone that repo separately and make the fix there (its own contributing docs apply, not this checkout's).
3. Only touch this checkout if you specifically need to bump clippy's subtree pointer here after the fix lands upstream — that's a separate, explicit task.

If you tell me the bug, I can help you understand/diagnose it here, but I won't edit clippy's source in this checkout.
