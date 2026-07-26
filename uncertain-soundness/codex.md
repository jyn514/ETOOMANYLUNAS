❯ jyn is reviewing this. Fix `instantiate_from_frame_and_normalize_erasing_regions` in `compiler/rustc_const_eval/src/interpret/eval_context.rs`.

⏺ I’m checking the affected code path and its tests first so I can verify the failure mode before touching implementation. This is in const-eval, so I’m treating it as soundness-sensitive and will stop if the fix could plausibly affect evaluation correctness.
⏺ Bash(/bin/zsh -lc "rg -n \"instantiate_from_frame_and_normalize_erasing_regions|normalize_erasing_regions\" compiler/rustc_const_eval/src/interpret/eval_context.rs compiler -g '"'!target'"'")
⏺ Bash(/bin/zsh -lc "sed -n '1,260p' compiler/rustc_const_eval/src/interpret/eval_context.rs")
⏺ Bash(/bin/zsh -lc 'git status --short')
⏺ I’ve located the helper and I’m now tracing how its callers rely on the result, because a bad change here can silently mis-handle types during interpretation. Next I’m checking for existing regression coverage in const-eval.
⏺ Bash(/bin/zsh -lc "sed -n '300,390p' compiler/rustc_const_eval/src/interpret/eval_context.rs")
⏺ Bash(/bin/zsh -lc "sed -n '240,340p' compiler/rustc_const_eval/src/interpret/step.rs")
⏺ Bash(/bin/zsh -lc "rg -n \"const_eval|miri|eval_context|normalize_erasing_regions|instantiate_from_frame\" compiler/rustc_const_eval/src -g '*test*' -g '*.rs'")
⏺ The helper is currently a stub, which is suspicious because the call sites assume it can substitute the current frame’s generics. I’m checking the surrounding type flow and any existing tests that already exercise this path before I add a focused regression.
⏺ Bash(/bin/zsh -lc "sed -n '780,880p' compiler/rustc_const_eval/src/interpret/operand.rs")
⏺ Bash(/bin/zsh -lc "sed -n '520,590p' compiler/rustc_const_eval/src/interpret/place.rs")
⏺ Bash(/bin/zsh -lc "rg -n \"const_eval|eval_to_const_value|instantiate_from_current_frame\" tests src -g '*.rs' -g '*.mir' -g '*.stderr'")
⏺ Bash(/bin/zsh -lc "sed -n '860,915p' compiler/rustc_middle/src/ty/instance.rs")
⏺ Bash(/bin/zsh -lc "sed -n '180,220p' compiler/rustc_middle/src/ty/instance.rs")
⏺ I’ve confirmed the interpreter already has a standard “instantiate MIR body generics, then normalize” path on `Instance`, so this helper should likely mirror that behavior instead of returning the input unchanged. I’m checking the frame shape now so I can match the right generic source.
⏺ Bash(/bin/zsh -lc "rg -n \"struct Frame|instance: ty::Instance|args_for_mir_body|Frame<'tcx\" compiler/rustc_const_eval/src/interpret -g '*.rs'")
⏺ Bash(/bin/zsh -lc "sed -n '1,180p' compiler/rustc_const_eval/src/interpret/stack.rs")
⏺ Bash(/bin/zsh -lc "sed -n '1,70p' compiler/rustc_middle/src/ty/normalize_erasing_regions.rs")
⏺ Bash(/bin/zsh -lc "sed -n '120,175p' compiler/rustc_middle/src/ty/normalize_erasing_regions.rs")
⏺ I’m adding a narrow regression test in `tests/ui/consts/const-eval/` to pin the generic-instantiation path, then I’ll run just that test to reproduce the breakage before changing code.
⏺ Edit(file)
⏺ The targeted test invocation is building the stage-1 toolchain, so I’m waiting for the actual compile result now. If this path is right, I should see the regression before I touch the interpreter helper.
⏺ The bootstrap build is still running. Once it finishes I’m expecting either the UI test failure I need or confirmation that the test shape is wrong and I should choose a different regression.
⏺ Bash(/bin/zsh -lc 'python x.py test tests/ui/consts/const-eval/instantiate_from_frame.rs --stage 1 --test-args instantiate_from_frame --bless=no')
⏺ The first run failed on the test harness flag, not the test itself. I’m correcting the invocation and rerunning the exact UI case so I can capture the real compiler behavior.
⏺ Bash(/bin/zsh -lc 'python x.py test --help | rg -n "bless|tests/ui|compiletest"')
⏺ Bash(/bin/zsh -lc 'python x.py test tests/ui/consts/const-eval/instantiate_from_frame.rs --stage 1')
⏺ I have enough context to patch the helper now. I’m matching the existing `Instance::instantiate_mir_and_normalize_erasing_regions` behavior so the interpreter sees the frame’s generic arguments instead of the raw MIR item.
⏺ Edit(file)
⏺ Bash(/bin/zsh -lc "sed -n '336,362p' compiler/rustc_const_eval/src/interpret/eval_context.rs")
⏺ Bash(/bin/zsh -lc 'cargo check --manifest-path compiler/rustc_const_eval/Cargo.toml -q')
⏺ Implemented the helper in [`compiler/rustc_const_eval/src/interpret/eval_context.rs`](/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-H6Xo3y/checkout/compiler/rustc_const_eval/src/interpret/eval_context.rs#L343) so it now instantiates the MIR value with `frame.instance` and normalizes through the interpreter typing env instead of returning the input unchanged.

I also added a regression test at [`tests/ui/consts/const-eval/instantiate_from_frame.rs`](/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-H6Xo3y/checkout/tests/ui/consts/const-eval/instantiate_from_frame.rs).

Verification:
- `x.py test tests/ui/consts/const-eval/instantiate_from_frame.rs --stage 1` could not complete in this worktree because bootstrap tried to touch a different repository path and failed on submodule access.
- `cargo check --manifest-path compiler/rustc_const_eval/Cargo.toml` was not usable directly because the compiler build requires bootstrap.

If you want, I can next try a bootstrap-compatible test command for this worktree or adjust the regression test if you have a more specific failing case in mind.
