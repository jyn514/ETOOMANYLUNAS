❯ Esteban is reviewing this. Fix `instantiate_from_frame_and_normalize_erasing_regions` in `compiler/rustc_const_eval/src/interpret/eval_context.rs`.

<details>
<summary>⏺ Commands (8)</summary>

```console
grep -n "instantiate_from_frame_and_normalize_erasing_regions" -A 30 compiler/rustc_const_eval/src/interpret/eval_context.rs | head -60
```

```console
git log -p -3 -- compiler/rustc_const_eval/src/interpret/eval_context.rs | grep -n "instantiate_from_frame_and_normalize_erasing_regions" -A 20 | head -100
```

```console
grep -rl "instantiate_from_frame_and_normalize_erasing_regions" compiler/ | head -20
```

```console
grep -n "instantiate_from_frame_and_normalize_erasing_regions\|instantiate_from_current_frame_and_normalize_erasing_regions" compiler/rustc_const_eval/src/interpret/stack.rs
```

```console
ls build/ 2>/dev/null; ls build/*/stage1/bin/rustc 2>/dev/null; cat config.toml 2>/dev/null | head -30
```

```console
grep -rl "const fn.*<T" tests/ui/consts/ 2>/dev/null | xargs -I{} sh -c 'grep -l "T::default\|T>()\|generic" {} ' 2>/dev/null | head -5
echo "---"
find tests/ui/consts -iname "*generic*" | head -20
```

```console
cat tests/ui/consts/const-eval/normalize-generic-const.rs
```

```console
timeout 590 ./x test tests/ui/consts/const-eval/normalize-generic-const.rs 2>&1 | tail -100
```

</details>
⏺ This will take a while since it needs a fresh build. I'll wait for it to complete rather than poll.
<details>
<summary>⏺ Command</summary>

```console
sleep 1
```

</details>
⏺ I'll let the background build/test run and check back when notified rather than polling.
⏺ ScheduleWakeup({"delaySeconds":1200,"prompt":"Check on background test run (ID b38xin1wj) building rustc and running tests/ui/consts/const-eval/normalize-generic-const.rs to verify the regression test for instantiate_from_frame_and_normalize_erasing_regions bug in eval_context.rs. Report result and continue per CLAUDE.md soundness gate (test-only, then classify, then stop before implementation).","reason":"rustc stage1 build + test typically takes 15-30 min; avoid short polling"})
⏺ Status while the test runs in the background:

**Reviewer:** Esteban (named) — gate satisfied.

**What I found:** `instantiate_from_frame_and_normalize_erasing_regions` (compiler/rustc_const_eval/src/interpret/eval_context.rs:343-354) has been stubbed to `Ok(value)` — it no longer calls `frame.instance.try_instantiate_mir_and_normalize_erasing_regions(...)`. This function is used at two call sites in `stack.rs`: instantiating const operands (line 402) and instantiating local variable types (line 624) when interpreting a generic MIR frame. Skipping instantiation means generic type parameters and projections (e.g. `T::Assoc`) in local types/consts are left un-substituted and un-normalized during const evaluation.

**Classification:** This is soundness-sensitive. It computes/transforms types (generic instantiation + normalization) feeding const-eval's type/layout machinery — squarely in the policy's soundness-sensitive list ("normalization and semantic caches," type computation for MIR interpretation). Per CLAUDE.md, implementation is banned for me; only test-only work is permitted right now.

**Test-only step in progress:** I located an existing check-pass regression candidate, `tests/ui/consts/const-eval/normalize-generic-const.rs`, which relies on exactly this instantiation (`let _: Option<T::Assoc> = None;` inside a `const fn` generic over `T`) succeeding at compile time. I'm building rustc and running that test now (background job) to confirm it fails with the stub in place, per the Testing gate (observe the failure before touching implementation). Will report the result once the build/test finishes — no implementation edits until then.
