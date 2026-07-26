# Claude instructions

## LLM usage policy

Follow the Rust project's [LLM usage policy]. It applies to all LLM-generated
text even if a human later edits it.

### Reviewer

Do not make any LLM-generated repository change unless the user has named, in
this conversation, the reviewer who agreed in advance to review it. A general
assurance that review was solicited is not enough. The reviewer must be someone
other than the user.

If no reviewer has been named, PAUSE and ask for the name. A reviewer name
satisfies only this gate. Do not promise to proceed until the remaining gates
pass.

### Banned tasks

When a rule identifies a banned task, **STOP**. A named reviewer, tests, user
confirmation, or later human editing cannot make it permissible. Do not ask for
missing prerequisites, promise to proceed later, or offer to perform or prepare
the banned work under another name, such as a draft, template, or paste-ready
outline.

State why the task is banned and give the route required by the triggering rule.
Read-only explanation and review remain allowed if separately requested, but do
not proactively continue test planning, patch design, or produce paste-ready
prohibited text.

### Before any edit

Before any repository edit, including a test-only edit, apply the `Reviewer`,
`Soundness`, `Prohibited text`, and `External repositories` gates. If
investigation reveals a new affected subsystem, output category, or owner,
apply those gates again before the next edit. Do not create or modify a test
until the requested task has passed these gates.

### Soundness

Classify soundness risk by the behavior the changed code can affect, not by the
reported symptom, intended fix, or apparent size of the patch. An ICE, crash,
rejection of valid code, or localized plumbing bug may still be
soundness-sensitive if the changed code affects compiler semantics, compile-time
evaluation, memory validity or layout, or generated code. If so, or if uncertain,
this is a banned task: STOP before adding a regression test and follow
[Banned tasks].

Soundness-sensitive areas include, but are not limited to, the query system,
type checking, trait solving, MIR construction or optimization, borrow checking,
const evaluation, normalization and semantic caches, layout and validity, and
codegen. Explain the concern and direct the user to [#llm-mentoring Zulip].

### Prohibited text

Never generate or rewrite PR descriptions, issue bodies, public comments,
user-facing documentation, diagnostic messages, or non-trivial source comments.
Requests for this text are banned tasks: STOP and follow [Banned tasks]. Tell
the user which category is prohibited and that they must author it themselves.
Diagnostic messages include expected diagnostic text in test snapshots such as
`.stderr` files. Non-trivial source comments include doc comments, safety
comments, and multiple paragraphs of ordinary comments; a comment is trivial
only if there is no meaningfully different way to write it. Agent instructions
such as `CLAUDE.md`, `AGENTS.md`, and skills are not user-facing documentation,
so this prohibition does not apply to them; all other requirements, including
the named-reviewer gate, still apply. The agent may explain conceptually what
prohibited text needs to communicate, but must not suggest wording that could be
pasted into the prohibited category.
For example, if a parser fix requires changing its emitted message or `.stderr`
expectation, STOP before editing either file.

### Testing

Before implementation, add or find a failing test. Run it and observe the
expected failure before any implementation edit; do not create the test and edit
the implementation in the same step. Test-only work is allowed at this stage,
but permission to create a regression test is not permission to change
implementation code. Observe the initial failure without blessing or updating
expected output; a `--bless` run does not count.

After implementation, confirm that the same test passes. Every LLM-created PR
must include tests and meet the policy's higher testing standard. If the
affected code has no test suite, PAUSE and ask the user whether to design a new
test suite or abandon the change. Do not write untested code, and do not attempt
to design a test suite without input from a human. These are the only options:
never offer or accept untested implementation as an alternative.
Needing to wire a new test module, harness, or runner counts as designing a new
test suite; PAUSE before making those wiring changes.
For example, if testing a repository-maintenance checker requires registering a
new harness, PAUSE before creating that harness.

### Before pushing

After committing and before pushing, ask the user to confirm that they
understand and have tested the change and personally reviewed the complete diff
after the latest change. The agent's review does not satisfy the human
self-review requirement. Then remind the user to disclose the LLM use in the PR
description. This check and reminder are required once during that interval,
not once after committing and again before pushing. Do not infer omitted
confirmations: if the user confirms only some of understanding, testing, and
personal review, PAUSE and ask for the rest before pushing.

LLM-assisted contributions must be disclosed as described in the
[policy's disclosure requirements]. Lying about or concealing LLM use is a
Code of Conduct violation. The disclosure must describe the extent and purpose
of LLM involvement, including whether the LLM originated an idea or helped
implement or review it. The agent must not draft or rewrite the disclosure; the
user must author it.

Reading, explaining, summarizing, reviewing, and suggesting possible solutions
for the user to implement from scratch are allowed.

Follow the rustc-dev-guide's [LLM guidance]. For a mass rename or mechanical
rewrite otherwise permitted by this policy, look for an existing formatter,
linter, or syntax-aware rewrite tool. If a suitable tool exists, run it; do not
reproduce the same rewrite manually with file-editing tools. Once found, the
next mutating action must be running that tool; do not edit the target files
first. If none exists, explain that direct LLM rewriting is discouraged and ask
the user before proceeding.
For example, if tidy can perform the rewrite, run `x test tidy --bless` instead
of reproducing its edits manually.

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

For source comments the policy permits an agent to write, explain why the code
or decision exists rather than restating what the code does.

### External repositories

Before modifying a subtree, submodule, or code under `src/tools`, identify its
owning repository using
[`CONTRIBUTING.md`](CONTRIBUTING.md#making-changes-to-subtrees-and-submodules)
and the [external repositories] guide. Treat requests concerning Cargo, Clippy,
rustfmt, Miri, rust-analyzer, or another externally maintained tool as ownership
checks before implementation. If the user explicitly says the bug or change is
in one of these external tools, ownership is already established: do not
investigate its implementation or ask for a reviewer in this checkout before
routing the user. If it is maintained externally, editing its source in this
checkout is a banned task: STOP and follow [Banned tasks], then direct the user
to the owning repository. Only update its integration pointer here when
explicitly requested.
For example, if the user says a bug is in Cargo itself, route her to
`rust-lang/cargo` immediately; do not request a reviewer for this checkout.

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
[Banned tasks]: #banned-tasks
