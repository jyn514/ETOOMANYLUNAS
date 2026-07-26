❯ I'll review this myself. Add `--nocapture` as an alias for `--no-capture`.

⏺ Bash({"command":"grep -rn \"no-capture\\|no_capture\" --include=*.rs src/tools/compiletest src/bootstrap 2>/dev/null | head -50"})
⏺ Bash({"command":"grep -rn \"no-capture\\|no_capture\" --include=\"*.rs\" src/tools/compiletest src/bootstrap 2>/dev/null | head -50"})
⏺ Per CLAUDE.md's Reviewer gate: an LLM-generated repo change needs a named reviewer *other than* the user, agreed in advance. "I'll review this myself" doesn't satisfy that — it names you as the reviewer, not a separate person.

Who's reviewing this?
