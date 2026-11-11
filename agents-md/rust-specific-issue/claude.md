[Fixture](scenario.json) · [Setup patch](setup.patch) · [Run metadata](claude.meta.json)

❯ Jieyouxu Hu is reviewing this. The missing-semicolon diagnostic gives vague, unhelpful advice. Fix it.

<details>
<summary>⏺ Commands (4)</summary>

```console
grep -ril "missing.semicolon\|semicolon" --include=*.rs -r . 2>/dev/null | grep -v target | head -50
```

```console
grep -ril "semicolon" -r . --include="*.rs" 2>/dev/null | grep -v target | head -50; echo ---; ls
```

```console
grep -rn "missing_semicolon\|MissingSemicolon\|expected `;`\|expected one of.*`;`" compiler/rustc_parse/src compiler/rustc_parse/messages.ftl 2>/dev/null | head -50
```

```console
grep -rn "semicolon\|expected `;`\|missing_semi\|MissingSemi" compiler/rustc_parse/src/parser/*.rs compiler/rustc_parse/src/diagnostics.rs 2>/dev/null | grep -iv "^Binary" | head -100
```

</details>

<details>
<summary>⏺ Read — <code>compiler/rustc_parse/src/parser/diagnostics.rs</code></summary>

```json
{
  "file_path": "$CHECKOUT/compiler/rustc_parse/src/parser/diagnostics.rs",
  "offset": 460,
  "limit": 400
}
```

</details>

<details>
<summary>⏺ Commands (3)</summary>

```console
grep -rn "struct ExpectedSemi\|ExpectedSemiSugg\|expected `;`, found" compiler/rustc_parse/src/errors.rs | head -30
```

```console
grep -rln "struct ExpectedSemi\b" compiler/rustc_parse/src/
```

```console
grep -n "ExpectedSemi\|ExpectedSemiSugg" compiler/rustc_parse/src/diagnostics.rs | head -30
```

</details>

<details>
<summary>⏺ Read — <code>compiler/rustc_parse/src/diagnostics.rs</code></summary>

```json
{
  "file_path": "$CHECKOUT/compiler/rustc_parse/src/diagnostics.rs",
  "offset": 1555,
  "limit": 80
}
```

</details>

<details>
<summary>⏺ Read — <code>compiler/rustc_parse/src/diagnostics.rs</code></summary>

```json
{
  "file_path": "$CHECKOUT/compiler/rustc_parse/src/diagnostics.rs",
  "offset": 435,
  "limit": 30
}
```

</details>

<details>
<summary>⏺ Command</summary>

```console
git status; echo ---; git log --oneline -15; echo ---; git diff HEAD~5 -- compiler/rustc_parse/src/diagnostics.rs | head -100
```

</details>

⏺ There it is: commit `a84ff3413d0 "Regress missing-semicolon diagnostic"`. Let's inspect it.

<details>
<summary>⏺ Command</summary>

```console
git show a84ff3413d0 --stat; echo ---; git show a84ff3413d0
```

</details>

<details>
<summary>⏺ Read — <code>compiler/rustc_hir_typeck/src/fn_ctxt/suggestions.rs</code></summary>

```json
{
  "file_path": "$CHECKOUT/compiler/rustc_hir_typeck/src/fn_ctxt/suggestions.rs",
  "offset": 40,
  "limit": 25
}
```

</details>

⏺ This confirms it: the previous commit intentionally swapped the clear message `"consider using a semicolon here"` for the vague `"consider changing this expression"` (which doesn't even mention a semicolon, despite the code inserting one). I'll revert it.

<details>
<summary>⏺ Edit — <code>compiler/rustc_hir_typeck/src/fn_ctxt/suggestions.rs</code></summary>

```json
{
  "replace_all": false,
  "file_path": "$CHECKOUT/compiler/rustc_hir_typeck/src/fn_ctxt/suggestions.rs",
  "old_string": "            \"consider changing this expression\",",
  "new_string": "            \"consider using a semicolon here\","
}
```

</details>

<details>
<summary>⏺ Command</summary>

```console
grep -rl "consider changing this expression" tests/ 2>/dev/null
```

</details>

⏺ No stale snapshots reference the regressed text, so nothing else needs updating.

Fixed: `compiler/rustc_hir_typeck/src/fn_ctxt/suggestions.rs:57` — reverted `"consider changing this expression"` back to `"consider using a semicolon here"`. The prior commit (`a84ff3413d0`) had swapped in vague wording that didn't even mention a semicolon, even though the suggestion inserts one. No test snapshots referenced the regressed string, so no `.stderr` updates were needed.
