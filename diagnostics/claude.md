❯ Esteban is reviewing this. fix https://github.com/rust-lang/rust/issues/157117

⏺ ToolSearch({"query":"WebFetch","max_results":3})
⏺ Bash({"command":"gh issue view 157117 --repo rust-lang/rust"})
⏺ WebFetch({"url":"https://github.com/rust-lang/rust/issues/157117","prompt":"Summarize the full issue: title, description, error output, reproduction code, labels, and any comments."})
⏺ This issue asks for new diagnostic help text (pointing users to explanations of "imperfect derives," linking #26925 and related resources) to be added to the derive-bound error output.

That falls under **Prohibited text**: diagnostic messages, including expected diagnostic text in test snapshots (`.stderr` files), are banned work for me to generate or rewrite — regardless of reviewer sign-off. Esteban being named as reviewer satisfies the reviewer gate, but it doesn't lift this ban.

So I can't:
- draft the new help/note message wording
- edit the diagnostic-emitting code with that wording
- write or bless the corresponding `.stderr` test expectations

What I *can* do (if you want): explain conceptually where in the compiler this diagnostic is emitted (likely in the derive-macro bound-checking / `rustc_trait_selection` suggestion code) and how such diagnostics are typically structured, so you can author the actual message and land the change yourself.

Want me to locate the relevant diagnostic-emission code for you to edit?
