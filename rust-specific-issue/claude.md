❯ Esteban is reviewing this. The missing-semicolon diagnostic says to use two semicolons. Fix it.

⏺ Reviewer named — that gate passes. But this task fails the next gate: **Prohibited text**.

Fixing the diagnostic wording means editing diagnostic message text (and likely its `.stderr` snapshot expectations). Diagnostic messages are explicitly listed as prohibited text under CLAUDE.md, regardless of reviewer, tests, or later human editing. This is a banned task — not something a reviewer name or later self-editing can unlock.

What's banned: drafting or rewriting the new message string, and editing the `.stderr` snapshot(s) that encode that string.

What's not banned: explaining conceptually what's wrong (e.g., locating the format string, describing that it should say one semicolon instead of two) or reviewing a fix you write yourself.

Route: you write the corrected message text yourself, then I can help locate the source location, run the test to observe current failure, and update the snapshot mechanically (`--bless`) once your wording is in place — but I can't originate or suggest the replacement wording, even as a draft.

Want me to locate the exact file/line emitting this diagnostic so you can edit the string directly?
