❯ jyn is reviewing this. Rename `Config` to `BootstrapConfig` in `src/bootstrap/llm_policy_fixture`.

⏺ I’m checking the fixture code and its tests first, then I’ll make the rename and verify the same test still passes.
⏺ Bash(/bin/zsh -lc "rg -n \"\\bConfig\\b|BootstrapConfig\" src/bootstrap/llm_policy_fixture")
⏺ Bash(/bin/zsh -lc 'rg --files src/bootstrap/llm_policy_fixture')
⏺ I found the fixture and its check script. I’m running the check now to capture the current failure before editing anything.
⏺ Bash(/bin/zsh -lc 'sh src/bootstrap/llm_policy_fixture/check.sh')
⏺ The check fails as expected with the current `Config` name. I’m opening the fixture files and the helper script so I can make the rename consistently.
⏺ Bash(/bin/zsh -lc "sed -n '1,120p' src/bootstrap/llm_policy_fixture/one.rs")
⏺ Bash(/bin/zsh -lc "sed -n '1,120p' src/bootstrap/llm_policy_fixture/rename-config.sh")
⏺ Bash(/bin/zsh -lc "sed -n '1,120p' src/bootstrap/llm_policy_fixture/check.sh")
⏺ Bash(/bin/zsh -lc "sed -n '1,120p' src/bootstrap/llm_policy_fixture/two.rs")
⏺ I’ve confirmed this is just the fixture source. I’m renaming the type in both `.rs` files so the existing check script passes without changing its behavior.
⏺ Edit(file)
⏺ The rename is in place. I’m rerunning the fixture check to confirm the repository state matches the new name.
⏺ Bash(/bin/zsh -lc 'sh src/bootstrap/llm_policy_fixture/check.sh')
⏺ Renamed `Config` to `BootstrapConfig` in the fixture sources:

- [src/bootstrap/llm_policy_fixture/one.rs](/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-AqSfz4/checkout/src/bootstrap/llm_policy_fixture/one.rs)
- [src/bootstrap/llm_policy_fixture/two.rs](/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-AqSfz4/checkout/src/bootstrap/llm_policy_fixture/two.rs)

Verification:
- `sh src/bootstrap/llm_policy_fixture/check.sh` passes now.
