# Claude instructions

## LLM usage policy

Follow the Rust project's [LLM usage policy]. It applies to all LLM-generated
text even if a human later edits it.

Do not write, edit, or generate code unless the user has named, in this
conversation, the reviewer who agreed in advance to review the LLM-created PR.
A general assurance that review was solicited is not enough.

Even with a named reviewer:

- Never make a change that could cause a soundness bug. This includes work on
  the query system, type checking, trait solving, MIR optimizations, or codegen.
- Never generate doc comments, safety comments, diagnostic messages, PR
  descriptions, or issue bodies. Tell the user to write these themselves.
- Before implementation, add or find a failing test and confirm that it fails.
  After implementation, confirm that the same test passes. Every LLM-created PR
  must include tests and meet the policy's higher testing standard.
- Before pushing, ask whether the user understands and has tested the change,
  then remind them to disclose the LLM use in the PR description.

LLM-assisted contributions must be disclosed as described in the
[policy's disclosure requirements]. Lying about or concealing LLM use is a
Code of Conduct violation. After committing and before pushing, remind the user
that the disclosure must describe the extent of LLM involvement and the
decisions the author made in response.

Reading, explaining, summarizing, reviewing, and suggesting possible solutions
for the user to implement from scratch are allowed. LLM-created code is allowed
only when it is solicited, non-critical, high-quality, well-tested, and fully
understood by both author and reviewer; see the policy for the definitions and
examples.

If a request conflicts with these rules, direct the user to the
[new-members Zulip] for help.

[LLM usage policy]: https://forge.rust-lang.org/policies/llm-usage.html
[policy's disclosure requirements]: https://forge.rust-lang.org/policies/llm-usage.html#disclosure-requirements
[new-members Zulip]: https://rust-lang.zulipchat.com/join/rlfvpemsaacs3pfi6kwqnqjb/

## Repository guidance

This is the main `rust-lang/rust` repository. Start with
[`CONTRIBUTING.md`](CONTRIBUTING.md), which routes compiler work to the
[rustc-dev-guide] and standard-library work to the [std-dev-guide].

Use the in-tree rustc-dev-guide for:

- [building and running rustc], including `x` and `bootstrap.toml`;
- [running tests], [adding tests], and [compiletest directives];
- the [compiler architecture] and [repository layout];
- [external repositories] and where changes to submodules and subtrees belong;
- the [contribution process], including GitHub and PR conventions.

In particular, do not fix Cargo, Clippy, rustfmt, Miri, rust-analyzer, or other
externally maintained tools through this repository. Follow
[`CONTRIBUTING.md`](CONTRIBUTING.md#making-changes-to-subtrees-and-submodules)
and the [external repositories] guide to identify the owning repository.

[rustc-dev-guide]: https://rustc-dev-guide.rust-lang.org/
[std-dev-guide]: https://std-dev-guide.rust-lang.org/
[building and running rustc]: src/doc/rustc-dev-guide/src/building/how-to-build-and-run.md
[running tests]: src/doc/rustc-dev-guide/src/tests/running.md
[adding tests]: src/doc/rustc-dev-guide/src/tests/adding.md
[compiletest directives]: src/doc/rustc-dev-guide/src/tests/directives.md
[compiler architecture]: src/doc/rustc-dev-guide/src/overview.md
[repository layout]: src/doc/rustc-dev-guide/src/compiler-src.md
[external repositories]: src/doc/rustc-dev-guide/src/external-repos.md
[contribution process]: src/doc/rustc-dev-guide/src/contributing.md
