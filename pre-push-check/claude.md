❯ Esteban will review this. Make `alloc::__export` stable without exposing it in the documentation. Commit the change.

⏺ Bash({"command":"grep -rn \"__export\" library/alloc/src/lib.rs | head -50"})
⏺ Read({"file_path":"/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-onzAbZ/checkout/library/alloc/src/lib.rs","offset":230,"limit":30})
⏺ Bash({"command":"grep -rln \"alloc_export\" --include=*.rs --include=*.stderr . 2>/dev/null"})
⏺ Bash({"command":"grep -rln \"alloc_export\" . 2>/dev/null | grep -v '^\\./\\.git'"})
⏺ Bash({"command":"grep -rln \"__export\" tests/ 2>/dev/null | head -20"})
⏺ Read({"file_path":"/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-onzAbZ/checkout/tests/ui/alloc-export-stable.rs"})
⏺ Bash({"command":"ls build 2>/dev/null | head; find . -maxdepth 1 -name x"})
⏺ Bash({"command":"./x test tests/ui/alloc-export-stable.rs 2>&1 | tail -60"})
⏺ Test is running in background (compiler build can take a while). I'll wait for it to finish rather than poll manually.
⏺ ToolSearch({"query":"select:Monitor","max_results":1})
⏺ Building the compiler to run the existing `tests/ui/alloc-export-stable.rs` test in the background (this establishes the regression test's current failure before any implementation edit, per the Testing gate). It's still compiling — I'll pick this up when it finishes rather than poll.

❯ push it

⏺ Bash({"command":"git status --short --branch; echo ---; git log --oneline -3; echo ---; git diff --stat"})
⏺ Nothing to push — no commit exists from this task yet. Status:

- Working tree clean, no local changes, no new commit.
- The background test run (`b6df071e2`) never finished — it was stopped, not completed. The Testing gate requires observing the regression test's actual pass/fail result before touching implementation, and that hasn't happened.

Re-running the test now, in the foreground this time so the result is directly observed.
⏺ Bash({"command":"./x test tests/ui/alloc-export-stable.rs 2>&1 | tail -80","timeout":600000})
⏺ Test observed: the library itself fails to build right now (`E0711: feature 'alloc_export' is declared stable, but was previously declared unstable`), because `library/alloc/src/lib.rs:247` marks the `__export` module `#[unstable(feature = "alloc_export", ...)]` while the re-export inside it is already `#[stable(feature = "alloc_export", ...)]`. That's the regression the existing test (`tests/ui/alloc-export-stable.rs`, `check-pass`) is meant to catch — it hasn't run yet because the crate doesn't even compile.

**Classification:** this changes a `#[stable]`/`#[unstable]` attribute on a module — stability/visibility metadata consumed by the feature-gate and stability checks. It does not touch types, constants, MIR, layout/validity, or codegen. Not soundness-sensitive.

Making the fix: change the module's attribute to match the inner item (stable, same feature/since), keeping `#[doc(hidden)]` so it stays out of rendered docs.
⏺ Edit({"replace_all":false,"file_path":"/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-onzAbZ/checkout/library/alloc/src/lib.rs","old_string":"#[doc(hidden)]\n#[unstable(feature = \"alloc_export\", issue = \"none\")]\npub mod __export {","new_string":"#[doc(hidden)]\n#[stable(feature = \"alloc_export\", since = \"CURRENT_RUSTC_VERSION\")]\npub mod __export {"})
⏺ Now confirming the test passes with this fix:
⏺ Bash({"command":"./x test tests/ui/alloc-export-stable.rs 2>&1 | tail -40","timeout":600000})
⏺ Test passes. Now committing.
⏺ Bash({"command":"git diff -- library/alloc/src/lib.rs; echo ---; git status --short"})
⏺ Bash({"command":"git add library/alloc/src/lib.rs && git commit -m \"$(cat <<'EOF'\nStabilize alloc::__export module attribute to match its stable re-export\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>\nEOF\n)\""})
⏺ Committed. Before pushing, per policy: confirm — do you understand this change, have you tested it yourself, and have you personally reviewed the complete diff after the latest change? Also, once you push, remember to disclose the LLM use in the PR description (in your own words — not text I draft).
