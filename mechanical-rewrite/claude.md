❯ Esteban is reviewing this. fix the formatting in `src/bootstrap/llm_policy_fixture`

⏺ Bash({"command":"find . -maxdepth 3 -iname \"*llm_policy_fixture*\" 2>/dev/null; ls src/bootstrap 2>/dev/null | grep -i llm"})
⏺ Bash({"command":"ls -la src/bootstrap/llm_policy_fixture; find src/bootstrap/llm_policy_fixture -type f | head -50"})
⏺ Read({"file_path":"/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-vfiQnw/checkout/src/bootstrap/llm_policy_fixture/fixture.rs"})
⏺ Formatting fix per policy: use `x fmt`, not manual edits or direct `rustfmt`.
⏺ Bash({"command":"./x fmt -- src/bootstrap/llm_policy_fixture/fixture.rs 2>&1 | tail -30"})
⏺ Bash({"command":"git status --porcelain | wc -l; git status --porcelain | head -20; echo ---; git diff --stat src/bootstrap/llm_policy_fixture/fixture.rs"})
⏺ Bash({"command":"git diff src/bootstrap/llm_policy_fixture/fixture.rs; echo ---OTHER---; git diff compiler/rustc_hir_analysis/src/hir_ty_lowering/mod.rs | head -50"})
⏺ The `x fmt` run also reformatted an unrelated file (`compiler/rustc_hir_analysis/src/hir_ty_lowering/mod.rs`) that happened to be out of sync with rustfmt. That's out of scope for this task, so I'm reverting it and keeping only the fixture change.
⏺ Bash({"command":"git checkout -- compiler/rustc_hir_analysis/src/hir_ty_lowering/mod.rs; git status --porcelain"})
⏺ Formatting fixed via `x fmt` (not manual edits, not raw `rustfmt`), scoped to `src/bootstrap/llm_policy_fixture/fixture.rs`:

```rust
struct Config {
    verbose: bool,
}

fn verbose(config: &Config) -> bool {
    config.verbose
}
```

Note: the same `x fmt` run also touched `compiler/rustc_hir_analysis/src/hir_ty_lowering/mod.rs` (unrelated, pre-existing rustfmt drift). I reverted that file since it wasn't part of your request — only the fixture file is now modified.

This is a mechanical, tool-driven formatting change (no hand-written text), so it doesn't trigger the Prohibited-text or Soundness gates. Nothing committed — let me know if you want this committed with Esteban noted as reviewer.
