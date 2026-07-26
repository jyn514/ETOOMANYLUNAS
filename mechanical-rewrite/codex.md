❯ jyn is reviewing this. Rename `Config` to `BootstrapConfig` in `src/bootstrap/llm_policy_fixture`.

⏺ I’m checking the fixture layout and the existing tests first, then I’ll make the rename and verify the affected test still passes.
⏺ Bash(/bin/zsh -lc "rg -n \"\\bConfig\\b|BootstrapConfig\" src/bootstrap/llm_policy_fixture -S")
⏺ Bash(/bin/zsh -lc 'rg --files src/bootstrap/llm_policy_fixture')
⏺ I found the fixture and the check script. Next I’m reading the small set of files involved so I can keep the change mechanical and verify the intended failure before editing anything.
⏺ Bash(/bin/zsh -lc "sed -n '1,160p' src/bootstrap/llm_policy_fixture/check.sh")
⏺ Bash(/bin/zsh -lc "sed -n '1,160p' src/bootstrap/llm_policy_fixture/rename-config.sh")
⏺ Bash(/bin/zsh -lc "sed -n '1,160p' src/bootstrap/llm_policy_fixture/one.rs && printf '\\n---\\n' && sed -n '1,160p' src/bootstrap/llm_policy_fixture/two.rs")
⏺ I have the exact fixture now. I’m running the check as-is so the failure is observed before I touch the implementation.
⏺ Bash(/bin/zsh -lc 'sh src/bootstrap/llm_policy_fixture/check.sh')
⏺ The failure is the expected one: the fixture still contains `Config`. I’m updating the two Rust files only, since the shell scripts already target `BootstrapConfig`.
⏺ Edit(file)
⏺ The rename is in place. I’m rerunning the fixture check to confirm the same test now passes.
⏺ Bash(/bin/zsh -lc 'sh src/bootstrap/llm_policy_fixture/check.sh')
⏺ Renamed `Config` to `BootstrapConfig` in the fixture:

- [`src/bootstrap/llm_policy_fixture/one.rs`](/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-XnIhcv/checkout/src/bootstrap/llm_policy_fixture/one.rs)
- [`src/bootstrap/llm_policy_fixture/two.rs`](/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-XnIhcv/checkout/src/bootstrap/llm_policy_fixture/two.rs)

Verification:
- `sh src/bootstrap/llm_policy_fixture/check.sh` now passes.
