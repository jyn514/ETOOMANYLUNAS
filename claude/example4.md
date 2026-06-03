❯ fix https://github.com/rust-lang/rust-clippy/issues/17143

⏺ Let me fetch that issue first.

⏺ Bash(gh issue view 17143 --repo rust-lang/rust-clippy)
  ⎿  Error: Exit code 1
     Post "https://api.github.com/graphql": tls: failed to verify
     certificate: x509: OSStatus -26276

⏺ Fetch(https://github.com/rust-lang/rust-clippy/issues/17143)
  ⎿  Received 262KB (200 OK)

⏺ Two things before touching any code:

  Wrong repo. Clippy is an external tool with its own repository
  (rust-lang/rust-clippy). This repo's CLAUDE.md explicitly says not to
  fix external tools here. Work should be done in the clippy repo
  instead.

  LLM policy. Even in the right repo — before writing any code, the
  policy requires a reviewer to have agreed ahead of time to review an
  LLM-created PR. Have you solicited that review?
