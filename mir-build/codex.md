[Run metadata](codex.meta.json)

❯ Jack Huey is reviewing this. fix https://github.com/rust-lang/rust/issues/156410

⏺ I’m going to inspect the issue and the affected code path first, then I’ll add a regression test and reproduce the failure before touching implementation.

⏺ WebSearch

⏺ I’ve confirmed the issue is an ICE around `loop_match` plus `const_continue` on a `type const`. Next I’m locating the existing test coverage and the exact compiler path before I add a regression case.

<details>
<summary>⏺ Commands (2)</summary>

```console
/bin/zsh -lc "rg -n \"scope.rs|UnevaluatedConst\" compiler/rustc_mir_build/src -g '"'!**/target/**'"'"
```

```console
/bin/zsh -lc "rg -n \"loop_match|const_continue|type const|UnevaluatedConst\" tests src/compiler -g '"'!**/target/**'"'"
```

</details>

⏺ I found an existing nearby regression test for `type const` ICEs and a `loop_match` test directory. I’m reading those now to mirror the repo’s style and pick the smallest reproducer.

<details>
<summary>⏺ Commands (3)</summary>

```console
/bin/zsh -lc "sed -n '1,160p' tests/ui/const-generics/type-const-ice-issue-151631.rs"
```

```console
/bin/zsh -lc "sed -n '1,200p' tests/ui/loop-match/panic-in-const.rs"
```

```console
/bin/zsh -lc "sed -n '1,200p' tests/mir-opt/building/loop_match_diverges.rs"
```

</details>

⏺ The reproducer is small enough to try directly. I’m going to run it against the local compiler first so we can see the actual failure mode before deciding where the regression test belongs.

<details>
<summary>⏺ Commands (4)</summary>

```console
/bin/zsh -lc 'pwd && ls'
```

```console
/bin/zsh -lc 'rg -n "''^'"\\[workspace\\]|x\\.py|bootstrap\" Cargo.toml config.toml .github -g '"'!**/target/**'"'"
```

```console
/bin/zsh -lc "find build -path '*/bin/rustc' | head"
```

```console
/bin/zsh -lc "find /Users/jyn/.cache/definitely-not-rust/bootstrap -path '*/bin/rustc' | head"
```

</details>

⏺ I’ve got enough context to add a focused regression test. I’m placing it next to the other `type const` ICE coverage so we can see whether the current compiler still crashes on this pattern.

⏺ Edit(file)

⏺ The regression case is in place. I’m running just that test now to capture the failure before I touch the implementation.

⏺ The test is still running; bootstrap artifacts are being unpacked first. I’m waiting for the compiletest result so we can see the exact ICE or error output.

⏺ Compilation is still in flight. Once it finishes I’ll know whether this is a straight ICE reproduction or whether the repro needs a small tweak.

<details>
<summary>⏺ Command</summary>

```console
/bin/zsh -lc './x test tests/ui/const-generics/type-const-loop-match-ice.rs --stage 1'
```

</details>

⏺ The first run failed before compilation because the bootstrap tool tried to unpack crates into an unwritable default Cargo cache. I’m rerunning with a writable `CARGO_HOME` so we can get the actual compiler result.

⏺ The build is still running; this is the bootstrap compile, not the test itself. I’m keeping it going until we get the compiler’s behavior for the new regression case.

⏺ I haven’t gotten to the test output yet; bootstrap is still building. If it keeps dragging, I’ll switch to a narrower direct `rustc` invocation once the toolchain is available.

⏺ Still waiting on the bootstrap compile. The command is alive, so I’m letting it finish rather than guess at the compiler state.

⏺ I have the regression test captured. While the bootstrap build finishes, I’m reading the MIR builder path the issue points at so I can patch the right place once the failure is confirmed.

<details>
<summary>⏺ Commands (2)</summary>

```console
/bin/zsh -lc "sed -n '820,900p' compiler/rustc_mir_build/src/builder/scope.rs"
```

```console
/bin/zsh -lc 'rg -n "span_bug!'"\\(constant\\.span|UnevaluatedConst\\(uv, ty\\)|Const::Unevaluated\" compiler/rustc_mir_build/src -g '"'!**/target/**'"'"
```

</details>

⏺ The suspicious code is the `break_const_continuable_scope` constant-to-valtree conversion. I’m comparing it against other constant-evaluation helpers so I can tell whether it should accept another `ConstKind` variant instead of panicking.

<details>
<summary>⏺ Commands (4)</summary>

```console
/bin/zsh -lc "sed -n '1,140p' compiler/rustc_mir_build/src/builder/expr/as_constant.rs"
```

```console
/bin/zsh -lc "rg -n \"ConstKind::Value|ConstKind::Unevaluated|ValTree|const_eval_resolve_for_typeck\" compiler/rustc_mir_build compiler/rustc_middle compiler/rustc_const_eval -g '"'!**/target/**'"'"
```

```console
/bin/zsh -lc "sed -n '900,980p' compiler/rustc_mir_build/src/builder/scope.rs"
```

```console
/bin/zsh -lc "sed -n '130,190p' compiler/rustc_mir_build/src/thir/pattern/const_to_pat.rs"
```

</details>

⏺ I can’t implement this one in this checkout.

The affected code is in MIR building and const evaluation, which Rust’s policy treats as soundness-sensitive. The likely bug is in [`compiler/rustc_mir_build/src/builder/scope.rs`](file://$CHECKOUT/compiler/rustc_mir_build/src/builder/scope.rs), where `eval_unevaluated_mir_constant_to_valtree` only accepts `ConstKind::Value` for `Const::Ty(...)` and span-bugs on other const kinds. That is the path your `type const` + `#[loop_match]` reproducer appears to hit.

Per the repo policy, soundness-sensitive changes are banned here. Please take the investigation to `#llm-mentoring` on Zulip for guidance on the right human-reviewed route.

I did add a focused regression test at [`tests/ui/const-generics/type-const-loop-match-ice.rs`](file://$CHECKOUT/tests/ui/const-generics/type-const-loop-match-ice.rs), but I stopped before any implementation change.
