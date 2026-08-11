❯ jyn is reviewing this. fix https://github.com/rust-lang/rust/issues/156410

⏺ I’m checking the issue details and the local area around the affected code first, then I’ll add a regression test and see whether the fix is soundness-sensitive before touching implementation.
⏺ WebSearch
⏺ I have the symptom: an ICE in MIR/const handling around `UnevaluatedConst`, triggered by `type const` plus `loop_match`/`const_continue`. I’m locating an existing compiletest bucket where that input belongs so I can add a failing regression first.
<details>
<summary>⏺ Commands (3)</summary>

```console
/bin/zsh -lc "rg -n \"UnevaluatedConst|loop_match|const_continue|min_generic_const_args|type const\" tests src/compiler -g '*.rs' -g '*.stderr'"
```

```console
/bin/zsh -lc "rg -n \"const_continue\" tests -g '*.rs' -g '*.stderr'"
```

```console
/bin/zsh -lc "rg -n \"loop_match\" tests -g '*.rs' -g '*.stderr'"
```

</details>
⏺ I’ve narrowed it to the const-generics area rather than the `loop_match` UI tests themselves. Next I’m checking the existing ICE regressions there so I can add a minimal reproducer in the right harness.
<details>
<summary>⏺ Commands (3)</summary>

```console
/bin/zsh -lc "sed -n '1,200p' tests/ui/const-generics/generic_const_exprs/unevaluated-const-ice-119731.rs"
```

```console
/bin/zsh -lc "sed -n '1,220p' tests/ui/const-generics/type-const-ice-issue-151631.rs"
```

```console
/bin/zsh -lc "sed -n '1,220p' tests/ui/loop-match/no-self-assign-ice.rs"
```

</details>
⏺ I’ve confirmed there are existing ICE regressions in `tests/ui/const-generics/`, so I’m following that pattern and checking how the repo records ICEs here before I add the new reproducer.
<details>
<summary>⏺ Commands (3)</summary>

```console
/bin/zsh -lc "sed -n '1,120p' tests/ui/const-generics/generic_const_exprs/unevaluated-const-ice-119731.rs"
```

```console
/bin/zsh -lc "sed -n '1,120p' tests/ui/const-generics/mgca/type-const-ice-issue-151631.rs"
```

```console
/bin/zsh -lc "rg -n \"known-bug|ICE|internal compiler error|ERROR: internal compiler error\" tests/ui/const-generics tests/ui/loop-match tests/ui -g '*.rs'"
```

</details>
⏺ I’m adding a minimal regression test under `tests/ui/const-generics/mgca/` that matches the issue’s shape: `type const` in a trait, a `#[loop_match]` loop, and `#[const_continue]` returning the associated const. After that I’ll run just that test and capture the ICE before changing code.
⏺ Edit(file)
⏺ The regression test is running now. Once it exits, I’ll use the result to classify the affected code path and decide whether the fix is implementation-safe or soundness-sensitive.
⏺ The build is still in progress; I’m waiting for the actual compiletest result so I can use the observed behavior, not assumptions, for the next step.
⏺ The compiler build is still churning. I haven’t changed implementation yet; I’m waiting for the test run to finish so I can see whether this is a straightforward ICE regression or something deeper in const/type handling.
⏺ The build is close to the test phase now. I’m still just observing the failure mode; no code fix has been attempted yet.
⏺ The build has reached the later compiler crates. Once the compiletest output lands, I’ll know whether this reproducer is the right one or needs tightening.
<details>
<summary>⏺ Command</summary>

```console
/bin/zsh -c './x test tests/ui/const-generics/mgca/issue-156410.rs --stage 1'
```

</details>
⏺ The `x test` run got blocked by an unrelated bootstrap warning in `alloc`, so I’m switching to a narrower direct compiler repro to observe the actual ICE without depending on a full stage1 rebuild.
<details>
<summary>⏺ Commands (3)</summary>

```console
/bin/zsh -c 'ls build/aarch64-apple-darwin/stage0/bin build/aarch64-apple-darwin/stage1/bin 2>/dev/null'
```

```console
/bin/zsh -c 'ls build/aarch64-apple-darwin/stage0/lib/rustlib/aarch64-apple-darwin/bin 2>/dev/null'
```

```console
/bin/zsh -c 'build/aarch64-apple-darwin/stage1/bin/rustc --crate-name issue_156410 --edition=2021 tests/ui/const-generics/mgca/issue-156410.rs -Zunstable-options --crate-type bin -L build/aarch64-apple-darwin/stage1/lib'
```

</details>
⏺ The direct stage1 invocation failed because the sysroot is incomplete on this host. I’m checking whether the stage0 toolchain or a bootstrapped sysroot can still run the reproducer locally; if not, I’ll need the exact compiler path from the bootstrap artifacts.
<details>
<summary>⏺ Commands (4)</summary>

```console
/bin/zsh -c "find build/aarch64-apple-darwin/stage0 -maxdepth 3 -type d | sed -n '1,40p'"
```

```console
/bin/zsh -c "find build/aarch64-apple-darwin/stage0/lib/rustlib -maxdepth 2 -type d | sed -n '1,60p'"
```

```console
/bin/zsh -c "find build/aarch64-apple-darwin/stage0/lib/rustlib/aarch64-apple-darwin/lib -maxdepth 1 -type f | sed -n '1,40p'"
```

```console
/bin/zsh -c 'build/aarch64-apple-darwin/stage0/bin/rustc --sysroot build/aarch64-apple-darwin/stage0 --crate-name issue_156410 --edition=2021 tests/ui/const-generics/mgca/issue-156410.rs --crate-type bin'
```

</details>
⏺ I added a regression test at tests/ui/const-generics/mgca/issue-156410.rs and reproduced the ICE with the local stage0 compiler.

What I observed:
- The reproducer hits `internal compiler error` in `compiler/rustc_mir_build/src/builder/scope.rs:854` while building MIR for `T::a`.
- The panic is triggered by `UnevaluatedConst { def: DefId(...::T::N), args: [Self/#0] }` at the `break 'blk Self::N` site.
- The behavior is in MIR construction / const handling, which is soundness-sensitive.

Because this is soundness-sensitive, I can’t make the implementation change here. Per the repo policy, this needs human handling or guidance on `#llm-mentoring` in Zulip before any fix is edited.

If you want, I can still help by:
1. Minimizing the reproducer further.
2. Pointing to the exact MIR builder path that is panicking.
3. Drafting a non-implementation diagnosis for a human to pick up.
