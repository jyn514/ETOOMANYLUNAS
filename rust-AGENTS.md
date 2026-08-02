# Agent instructions

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
For example, “Esteban is reviewing this” names a reviewer; do not ask the user
to confirm that Esteban agreed.

### Banned tasks

When a rule identifies banned work, **STOP** that work. A named reviewer, tests,
user confirmation, or later human editing cannot make the banned work
permissible. A rule may explicitly permit narrower preliminary work; Soundness
permits and requires test-only work before implementation stops. Do not ask for
missing prerequisites, promise to proceed later, or offer to perform or prepare
the banned work under another name, such as a draft, template, or paste-ready
outline.

State why the work is banned and give the route required by the triggering rule.
Reading, explaining, summarizing, reviewing, and suggesting possible solutions
for the user to implement from scratch remain allowed if separately requested.
Do not proactively continue test planning, patch design, or produce paste-ready
prohibited text unless the triggering rule explicitly requires test-only work.

### Before any edit

Before any repository edit, including a test-only edit, check `External
repositories` first, then `Prohibited text`, then `Reviewer`. Apply the
`Soundness` gate after adding or finding the failing test and before
implementation. If investigation reveals a new output category or owner, apply
the relevant gate again before the next edit. Do not create or modify a test
until the requested task has passed the gates that precede test edits.
For formatting or another mechanical rewrite, do not edit target files
directly; follow [Mechanical rewrites](#mechanical-rewrites) before the first
mutation.

### Soundness

Soundness-sensitive implementation is banned, but adding or locating a failing
regression test is permitted and required. Even if you recognize the soundness
risk earlier, complete the test-only work, then state the classification and
STOP before planning or editing implementation.
Wait for the regression-test command to exit, leave the test in the tree, and
report its result. Do not remove the test merely because implementation is
banned.

After adding or finding the failing test, but before planning or editing the
implementation, state which behavior the affected code controls and classify
the task as soundness-sensitive or not. Do not promise implementation before
completing this classification. If investigation later reveals a different
affected behavior, repeat the classification before the next implementation
edit.

Code that computes or transforms types, constants, MIR, memory layout or
validity, or generated code is soundness-sensitive. The reported symptom,
intended fix, and apparent size of the patch do not change this classification:
an ICE, crash, rejection of valid code, or localized plumbing bug may still be
soundness-sensitive. If the task is soundness-sensitive or uncertain,
implementation is banned: STOP before editing it and follow [Banned tasks].

Soundness-sensitive areas include, but are not limited to, the query system,
type checking, trait solving, MIR construction or optimization, borrow checking,
const evaluation, normalization and semantic caches, layout and validity, and
codegen. Explain the concern and direct the user to [#llm-mentoring Zulip].

### Prohibited text

Never generate or rewrite non-trivial PR descriptions, issue bodies, public
comments, user-facing documentation, diagnostic messages, or source comments.
Requests for this text are banned tasks: STOP and follow [Banned tasks]. Tell
the user which category is prohibited and that they must author it themselves.
Do not originate or manually rewrite expected diagnostic text in test snapshots
such as `.stderr` files. After the user authors the diagnostic message in source,
the agent may mechanically regenerate its snapshots with an existing tool such
as `x test ... --bless`; follow [Mechanical rewrites](#mechanical-rewrites).
A code or prose change is trivial only if there is no meaningfully different way
to write it or the alternatives are nearly identical, such as fixing a typo or
Markdown link, replacing a word with a synonym, or adding a required trait
signature. Trivial changes are not banned, but must pass all other gates and be
disclosed.

Agent instructions such as `CLAUDE.md`, `AGENTS.md`, and skills are not
user-facing documentation, but may only link to or summarize existing
human-facing documentation. Before adding process or workflow guidance, locate
the human-facing source. If none exists, PAUSE and ask the user to document the
process for humans first; do not make an agent file the sole source of a rule or
add details absent from the human-facing source. All other requirements,
including the named-reviewer gate, still apply.

The agent may explain conceptually what prohibited text needs to communicate,
but must not suggest wording that could be pasted into the prohibited category.
For example, if a parser fix requires changing its emitted message, STOP before
editing the message or its `.stderr` expectation. Once the user writes the
message, the agent may regenerate the expectation mechanically.

### Testing

Before fixing a bug, add or find a failing test. Run it and observe the
expected failure before any implementation edit; do not create the test and edit
the implementation in the same step. A test is not observed until its command
exits and reports a result. If it is still running, continue waiting; do not edit
implementation or begin other work. Test-only work is allowed at this stage,
but permission to create a regression test is not permission to change
implementation code. Observe the initial failure without blessing or updating
expected output; a `--bless` run does not count.

After implementing a bug fix, confirm that the same test passes.

Every LLM-created PR must include tests and meet the policy's higher testing
standard. If the affected code has no test suite, PAUSE and ask the user whether
to design a new test suite or abandon the change. Do not write untested code,
and do not attempt to design a test suite without input from a human. These are
the only options:
never offer or accept untested implementation as an alternative.

An existing test suite must already be able to observe the affected behavior
without changing production structure. An existing Cargo or compiletest harness
alone does not satisfy this requirement.

If the first viable test requires any production-code edit, PAUSE before that
edit: designing that observation boundary is test-suite design.

If testing requires choosing a new observation or dependency-injection
boundary—such as extracting production logic, creating a shared helper or
module, exposing internals, introducing a fake subprocess, or registering a new
harness or runner—that is test-suite design; PAUSE and ask before making those
changes.

Adding a test module is allowed when it exercises existing callable behavior
without restructuring production code.

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
user must author it. Do NOT add `Co-Authored-By` trailers to commits.

### Mechanical rewrites

Follow the rustc-dev-guide's [LLM guidance]. For a mass rename or mechanical
rewrite otherwise permitted by this policy, look for an existing formatter,
linter, or syntax-aware rewrite tool. If a suitable tool exists, run it; do not
reproduce the same rewrite manually with file-editing tools. Once found, the
next mutating action must be running that tool; do not edit the target files
first. If none exists, explain that direct LLM rewriting is discouraged and ask
the user before proceeding.
For Rust formatting, use `x fmt`; do not invoke `rustfmt` directly.
For example, if tidy can perform the rewrite, run `x test tidy --bless` instead
of reproducing its edits manually.

Before regenerating snapshots containing human-facing text:

1. Confirm the user already authored the new prose in source.
2. Run the focused test without `--bless` and observe the expected mismatch.
3. Run the repository's existing `--bless` command.
4. Inspect the generated diff. Do not manually repair or add prose; if the tool
   produced unexpected human-facing text, STOP and report it to the user.

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

Use `x` as the default entry point for repository builds, tests, and formatting.
Do not invoke Cargo directly unless the relevant in-tree documentation
explicitly requires it.

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
