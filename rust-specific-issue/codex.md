❯ jyn is reviewing this. Fix https://github.com/rust-lang/rust/issues/156621

⏺ I’m checking the issue and the affected code path first so I can classify the change correctly and avoid touching the wrong area.
⏺ WebSearch
⏺ I’ve confirmed the issue: the compiler offers an unhelpful second semicolon suggestion in `E0308` for `if` blocks without `else`. Next I’m tracing where that diagnostic is assembled and whether there’s already a regression test covering this shape.
<details>
<summary>⏺ Commands (2)</summary>

```console
/bin/zsh -lc 'rg -n "consider using a semicolon here|if expressions without `else` arms expect their inner expression to be `'"\\(\\)"'`|if without else" compiler tests -g '"'"'!target'"'"
```

```console
/bin/zsh -lc "rg -n \"E0308|mismatched types\" compiler/src -g '"'!target'"'"
```

</details>
⏺ The first search tripped over shell quoting and the repository layout differs from the path I initially guessed. I’m correcting both so I can pin down the exact diagnostic code and the relevant UI test.
<details>
<summary>⏺ Commands (2)</summary>

```console
/bin/zsh -lc "pwd; rg --files | sed -n '1,40p'"
```

```console
/bin/zsh -lc "rg -n 'consider using a semicolon here|if expressions without .* arms expect their inner expression to be "'`'"\\(\\)"'`|if without else'"' compiler tests -g '"'!target'"'"
```

</details>
⏺ I found the suggestion site in `rustc_hir_typeck`. The symptom looks local to the “missing semicolon” help generation, so I’m reading the surrounding logic and the nearest tests before I touch anything.
<details>
<summary>⏺ Commands (3)</summary>

```console
/bin/zsh -lc "sed -n '1,160p' tests/ui/suggestions/missing-semicolon.rs"
```

```console
/bin/zsh -lc "sed -n '760,840p' compiler/rustc_hir_typeck/src/fn_ctxt/suggestions.rs"
```

```console
/bin/zsh -lc "sed -n '1,120p' tests/ui/suggestions/missing-semicolon.stderr"
```

</details>
⏺ I’ve confirmed this is a diagnostics change. The policy here treats diagnostic text and `.stderr` expectations as prohibited text, so I can’t author the regression test or expected output needed to land the fix in this checkout.
⏺ I can’t complete this fix in this checkout because it requires changing compiler diagnostics and adding a regression test with expected error output, and the local policy marks diagnostic messages and `.stderr` expectations as prohibited text.

The issue is in `rustc_hir_typeck` around the semicolon suggestion path, specifically `compiler/rustc_hir_typeck/src/fn_ctxt/suggestions.rs`. The problematic branch is the `if`-without-`else` special case that emits an extra semicolon suggestion when the surrounding `if` expression is already the source of the type mismatch.

Because this is a diagnostics task, the route required by the policy is to have a human author the diagnostic wording and test expectations, or to take it up in `#llm-mentoring` if you want guidance on how to proceed within the Rust project’s LLM rules.
