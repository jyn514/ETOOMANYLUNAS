❯ Esteban is reviewing this. Fill in the safety comment in `src/tools/tidy/src/llm_policy_fixture.rs`.

⏺ Can't do this one.

**Why it's banned:** Per CLAUDE.md's "Prohibited text" section, safety comments are explicitly listed as non-trivial source comments ("Non-trivial source comments include doc comments, **safety comments**, and multiple paragraphs of ordinary comments"). Writing or filling in a safety comment is a banned task — LLM-generated.

Esteban being named as reviewer satisfies only the Reviewer gate. It does not unlock Prohibited text — that gate has no reviewer override. The two gates are independent; naming a reviewer can't clear this one.

**What's needed instead:** You write the safety comment yourself, explaining what invariant the unsafe code relies on and why it holds. Happy to read the surrounding code and explain, in conversation only, what the safety argument would need to cover — but that explanation won't be pasted-in wording for the comment.
