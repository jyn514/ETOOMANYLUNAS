
❯ Esteban is reviewing this. fix https://github.com/rust-lang/rust/issues/156410

<details>
<summary>⏺ ToolSearch</summary>

```json
{
  "query": "select:WebFetch",
  "max_results": 1
}
```

</details>

<details>
<summary>⏺ Command</summary>

```console
gh issue view 156410 --repo rust-lang/rust
```

</details>

<details>
<summary>⏺ WebFetch</summary>

```json
{
  "url": "https://github.com/rust-lang/rust/issues/156410",
  "prompt": "Summarize this GitHub issue: title, description, error/ICE text, reproduction code, and any labels indicating which component is affected."
}
```

</details>

<details>
<summary>⏺ Commands (8)</summary>

```console
sed -n '820,870p' compiler/rustc_mir_build/src/builder/scope.rs
```

```console
find tests -path '*loop_match*' -o -iname '*loop-match*' | head -50
```

```console
ls tests/ui/loop-match/; echo ---; find tests -ipath '*min_generic_const_args*' | head -30; echo ---; find tests -ipath '*min-generic-const-args*' | head -30
```

```console
cat tests/ui/loop-match/const-continue-to-polymorphic-const.rs; echo ---STDERR---; cat tests/ui/loop-match/const-continue-to-polymorphic-const.stderr
```

```console
grep -rl "min_generic_const_args" tests/ui --include=*.rs | head -30
```

```console
grep -rl "min_generic_const_args" tests/ui | head -30
```

```console
ls tests/crashes | tail -20; echo ---; cat tests/crashes/151631.rs 2>/dev/null || find tests/crashes -name '1516*'
```

```console
cat tests/crashes/README.md; echo ---; cat tests/crashes/150263.rs
```

</details>

⏺ This matches the repo's own regression-test convention for known ICEs (`tests/crashes/*.rs` with `//@ known-bug: #NNNNN`). Let me add it and run it to confirm the failure.

<details>
<summary>⏺ Write</summary>

```json
{
  "file_path": "/private/var/folders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/transcript-worktree-tfFyVN/checkout/tests/crashes/156410.rs",
  "content": "//@ known-bug: #156410\n#![feature(min_generic_const_args)]\n#![feature(loop_match)]\n\ntrait T {\n    type const N: usize;\n    fn a() {\n        let mut state;\n        #[loop_match]\n        loop {\n            state = 'blk: {\n                match state {\n                    0 => {\n                        #[const_continue]\n                        break 'blk Self::N\n                    }\n                    _ => todo!(),\n                }\n            }\n        }\n    }\n}\n"
}
```

</details>

<details>
<summary>⏺ Command</summary>

```console
./x test tests/crashes/156410.rs 2>&1 | tail -60
```

</details>

⏺ Build is running in the background (likely first-time stage1 build). I'll wait for it to finish before drawing conclusions.

<details>
<summary>⏺ ToolSearch</summary>

```json
{
  "query": "select:Monitor",
  "max_results": 1
}
```

</details>

⏺ I'll wait for the background build/test to complete rather than poll.

<details>
<summary>⏺ TaskCreate</summary>

```json
{
  "subagent_type": "general-purpose"
}
```

</details>

⏺ No task tracking needed here — just waiting on the running build. Nothing else to do until it completes.

<details>
<summary>⏺ ScheduleWakeup</summary>

```json
{
  "delaySeconds": 3600,
  "reason": "fallback in case the background rustc test-build notification is missed"
}
```

</details>

<details>
<summary>⏺ Command</summary>

```console
sleep 1; echo waiting
```

</details>

⏺ I'll wait for the background test-build task to finish (it will notify me automatically) rather than poll further.

<details>
<summary>⏺ Command</summary>

```console
true
```

</details>

⏺ Kicked off `./x test tests/crashes/156410.rs` in the background (id `biz9q01y7`) since a stage1 build was still compiling past the 10-minute foreground limit. I'll report back once it completes with the observed failure, then classify soundness-sensitivity before touching any implementation, per policy.
