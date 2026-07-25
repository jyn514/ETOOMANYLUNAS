# Claude instructions

## LLM usage policy

Follow the Rust project's [LLM usage policy]. It applies to all LLM-generated
text even if a human later edits it.

Do not write, edit, or generate code unless the user has named, in this
conversation, the reviewer who agreed in advance to review the LLM-created PR.
A general assurance that review was solicited is not enough. The reviewer must
be someone other than the user.

Even with a named reviewer:

- Before editing code, identify the affected subsystem. If the change touches
  the query system, type checking, trait solving, MIR construction or
  optimization, borrow checking, or codegen, or if its soundness impact is
  uncertain, do not edit it. Explain the concern and direct the user to
  [#llm-mentoring Zulip].
- Never generate or rewrite PR descriptions, issue bodies, public comments,
  user-facing documentation, diagnostic messages, or non-trivial source
  comments. Tell the user which category is prohibited and that they must
  author it themselves. Non-trivial source comments include doc comments,
  safety comments, and multiple paragraphs of ordinary comments; a comment is
  trivial only if there is no meaningfully different way to write it. Agent
  instructions such as `CLAUDE.md`, `AGENTS.md`, and skills are not user-facing
  documentation and may be edited by an agent. The agent may explain
  conceptually what prohibited text needs to communicate, but must not suggest
  wording that could be pasted into the prohibited category.
- Before implementation, add or find a failing test and confirm that it fails.
  Test-only work is allowed at this stage, but permission to create a regression
  test is not permission to change implementation code.
  After implementation, confirm that the same test passes. Every LLM-created PR
  must include tests and meet the policy's higher testing standard. If the
  affected code has no test suite, STOP and ask the user whether to design a
  new test suite or abandon the change. Do not write untested code, and do not
  attempt to design a test suite without input from a human.
- After committing and before pushing, ask the user to confirm that they
  understand and have tested the change and personally reviewed the complete
  diff after the latest change. The agent's review does not satisfy the human
  self-review requirement. Then remind the user to disclose the LLM use in the
  PR description. This check and reminder are required once during that
  interval, not once after committing and again before pushing.

LLM-assisted contributions must be disclosed as described in the
[policy's disclosure requirements]. Lying about or concealing LLM use is a
Code of Conduct violation. The disclosure must describe the extent and purpose
of LLM involvement, including whether the LLM originated an idea or helped
implement or review it. The agent must not draft or rewrite the disclosure; the
user must author it.

Reading, explaining, summarizing, reviewing, and suggesting possible solutions
for the user to implement from scratch are allowed.

Follow the rustc-dev-guide's [LLM guidance]. Before a mass rename or mechanical
rewrite, look for an existing formatter, linter, or syntax-aware rewrite tool
and use it when available. If none exists, explain that direct LLM rewriting is
discouraged and ask the user before proceeding.

If a request conflicts with these rules, direct the user to the
[#llm-mentoring Zulip] for help.

[LLM usage policy]: https://forge.rust-lang.org/policies/llm-usage.html
[policy's disclosure requirements]: https://forge.rust-lang.org/policies/llm-usage.html#disclosure-requirements
[LLM guidance]: https://rustc-dev-guide.rust-lang.org/llm-guidance.html
[#llm-mentoring Zulip]: https://rust-lang.zulipchat.com/#narrow/channel/606558-llm-mentoring/

## Repository guidance

This is the main `rust-lang/rust` repository. Start with
[`CONTRIBUTING.md`](CONTRIBUTING.md), which routes compiler work to the
[rustc-dev-guide] and standard-library work to the [std-dev-guide].

Use the in-tree rustc-dev-guide for:

- [building and running rustc], including `x` and `bootstrap.toml`;
- [running tests], [adding tests], and [compiletest directives];
- [formatting and tidy];
- the [compiler architecture] and [repository layout];
- [external repositories] and where changes to submodules and subtrees belong;
- the [contribution process], including GitHub and PR conventions.

When code needs a comment, explain why the code or decision exists rather than
restating what the code does.

Before modifying a subtree, submodule, or code under `src/tools`, identify its
owning repository using
[`CONTRIBUTING.md`](CONTRIBUTING.md#making-changes-to-subtrees-and-submodules)
and the [external repositories] guide. If it is maintained externally, do not
edit its source here; direct the user to the owning repository. Only update its
integration pointer here when explicitly requested.

[rustc-dev-guide]: src/doc/rustc-dev-guide/
[std-dev-guide]: https://std-dev-guide.rust-lang.org/
[building and running rustc]: src/doc/rustc-dev-guide/src/building/how-to-build-and-run.md
[running tests]: src/doc/rustc-dev-guide/src/tests/running.md
[adding tests]: src/doc/rustc-dev-guide/src/tests/adding.md
[compiletest directives]: src/doc/rustc-dev-guide/src/tests/directives.md
[formatting and tidy]: src/doc/rustc-dev-guide/src/conventions.md#formatting
[compiler architecture]: src/doc/rustc-dev-guide/src/overview.md
[repository layout]: src/doc/rustc-dev-guide/src/compiler-src.md
[external repositories]: src/doc/rustc-dev-guide/src/external-repos.md
[contribution process]: src/doc/rustc-dev-guide/src/contributing.md
