[Run metadata](claude.meta.json)

❯ Jieyouxu Hu is reviewing this. fix https://github.com/rust-lang/rust/issues/156733

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
<summary>⏺ Commands (2)</summary>

```console
gh issue view 156733 --repo rust-lang/rust
```

```console
gh issue view 156733 --repo rust-lang/rust
```

</details>

<details>
<summary>⏺ WebFetch</summary>

```json
{
  "url": "https://github.com/rust-lang/rust/issues/156733",
  "prompt": "Give me the full issue title, description, code reproduction, expected vs actual behavior, and any comments with diagnosis or discussion."
}
```

</details>

<details>
<summary>⏺ Command</summary>

```console
grep -rn "fn grow" library/core/src/alloc/mod.rs | head -50
```

</details>

<details>
<summary>⏺ Read — <code>library/core/src/alloc/mod.rs</code></summary>

```json
{
  "file_path": "library/core/src/alloc/mod.rs",
  "offset": 1,
  "limit": 420
}
```

</details>

<details>
<summary>⏺ WebFetch</summary>

```json
{
  "url": "https://github.com/rust-lang/rust/issues/156733",
  "prompt": "Quote the issue body verbatim, including any quoted doc text, bullet points, and suggested wording changes. Do not summarize."
}
```

</details>

<details>
<summary>⏺ Commands (3)</summary>

```console
grep -rn "transferred to this allocator\|memory block referenced by\|has been \[\*invalidated\*\]" library/core/src/alloc/mod.rs
```

```console
grep -rln "transferred" library/ 2>/dev/null
```

```console
cd . && git log --oneline -5 -- library/core/src/alloc/mod.rs
```

</details>

<details>
<summary>⏺ WebFetch</summary>

```json
{
  "url": "https://github.com/rust-lang/rust/issues/156733.diff",
  "prompt": "output whatever text is returned verbatim"
}
```

</details>

<details>
<summary>⏺ WebFetch</summary>

```json
{
  "url": "https://api.github.com/repos/rust-lang/rust/issues/156733",
  "prompt": "Return the \"body\" field value verbatim, in full, unmodified."
}
```

</details>

<details>
<summary>⏺ Read — <code>library/core/src/alloc/mod.rs</code></summary>

```json
{
  "file_path": "library/core/src/alloc/mod.rs",
  "offset": 373,
  "limit": 55
}
```

</details>

<details>
<summary>⏺ Edit — <code>library/core/src/alloc/mod.rs</code></summary>

```json
{
  "replace_all": false,
  "file_path": "library/core/src/alloc/mod.rs",
  "old_string": "    /// If this returns `Ok`, then the memory block referenced by `ptr` has been [*invalidated*].\n    /// The old `ptr` must not be used to access the memory, even if the allocation was grown in-place.\n    /// The newly returned pointer is the only valid pointer for accessing this memory now.\n    ///\n    /// If this method returns `Err`, then the memory block has not been *invalidated*,\n    /// and the contents of the memory block are unaltered.",
  "new_string": "    /// If this returns `Ok`, then the memory block referenced by `ptr` has been [*invalidated*],\n    /// meaning ownership of it has been returned to this allocator. Any access to the old `ptr` is\n    /// Undefined Behavior, even if the allocation was grown in-place. In particular, it is UB to\n    /// offset the old `ptr`, except by an offset of 0, since it is now derived from a freed\n    /// allocation. The newly returned pointer is the only valid pointer for accessing this memory\n    /// now.\n    ///\n    /// If this method returns `Err`, then the memory block has not been [*invalidated*],\n    /// and the contents of the memory block are unaltered."
}
```

</details>

<details>
<summary>⏺ Edit — <code>library/core/src/alloc/mod.rs</code></summary>

```json
{
  "replace_all": false,
  "file_path": "library/core/src/alloc/mod.rs",
  "old_string": "    /// If this returns `Ok`, then the memory block referenced by `ptr` has been [*invalidated*].\n    /// The old `ptr` must not be used to access the memory, even if the allocation was shrunk in-place.\n    /// The newly returned pointer is the only valid pointer for accessing this memory now.\n    ///\n    /// If this method returns `Err`, then the memory block has not been *invalidated*,\n    /// and the contents of the memory block are unaltered.",
  "new_string": "    /// If this returns `Ok`, then the memory block referenced by `ptr` has been [*invalidated*],\n    /// meaning ownership of it has been returned to this allocator. Any access to the old `ptr` is\n    /// Undefined Behavior, even if the allocation was shrunk in-place. In particular, it is UB to\n    /// offset the old `ptr`, except by an offset of 0, since it is now derived from a freed\n    /// allocation. The newly returned pointer is the only valid pointer for accessing this memory\n    /// now.\n    ///\n    /// If this method returns `Err`, then the memory block has not been [*invalidated*],\n    /// and the contents of the memory block are unaltered."
}
```

</details>

<details>
<summary>⏺ Command</summary>

```console
grep -n "invalidated\*\." library/core/src/alloc/mod.rs; grep -n "transferred to this allocator" -r library/core/src/alloc/mod.rs
```

</details>

⏺ Now let's view the final diff to confirm correctness.

<details>
<summary>⏺ Command</summary>

```console
git diff -- library/core/src/alloc/mod.rs
```

</details>

⏺ Now let's check that the doc still builds (rustdoc lint for broken intra-doc links), and check formatting/line length via tidy if quick.

<details>
<summary>⏺ Command</summary>

```console
cd library/core && rustc --edition 2021 --crate-type lib -Z parse-crate-root-only src/lib.rs 2>&1 | head -5 || true; echo "---"; grep -n "^.\{101,\}$" src/alloc/mod.rs | head -20
```

</details>

⏺ Pre-existing long lines are fine (not new ones I added, they're all ≤100 for my added lines). Let's double check my new lines specifically don't exceed 100 chars.

<details>
<summary>⏺ Commands (2)</summary>

```console
awk 'NR==252||NR==253||NR==254||NR==255||NR==256||NR==385||NR==386||NR==387||NR==388||NR==389 {print NR": "length($0)}' library/core/src/alloc/mod.rs
```

```console
nl -ba library/core/src/alloc/mod.rs | sed -n '249,262p;380,393p'
```

</details>

<details>
<summary>⏺ Read — <code>library/core/src/alloc/mod.rs</code></summary>

```json
{
  "file_path": "library/core/src/alloc/mod.rs",
  "offset": 246,
  "limit": 15
}
```

</details>

<details>
<summary>⏺ Read — <code>library/core/src/alloc/mod.rs</code></summary>

```json
{
  "file_path": "$CHECKOUT/library/core/src/alloc/mod.rs",
  "offset": 246,
  "limit": 15
}
```

</details>

⏺ These lines are within reasonable width (~100 chars max, consistent with existing style). The fix is complete.

<details>
<summary>⏺ Command</summary>

```console
cd $CHECKOUT && git diff --stat
```

</details>

⏺ ## Summary

Fixed [rust-lang/rust#156733](https://github.com/rust-lang/rust/issues/156733), a docs issue for `Allocator::grow`/`shrink`.

The issue (filed after a Zulip discussion) flagged two problems in `library/core/src/alloc/mod.rs`:
1. The old "must not be used to access the memory" phrasing didn't spell out that this is full UB, including offsetting the pointer (even by a non-dereferencing amount), since after the call it's derived from a freed allocation.
2. The `Err` branch used a bare `*invalidated*` (no link) instead of the linked `[*invalidated*]`, breaking the connection to the trait's already-established "invalidated" terminology.

I updated the doc comments for both `grow` and `shrink` (in `library/core/src/alloc/mod.rs`) to:
- explicitly state that on `Ok`, ownership of the block has been returned to the allocator (tying back to the trait's existing `[*invalidated*]` glossary term rather than introducing new competing terminology like the issue's raw suggestion did),
- state plainly that *any* access to the old `ptr` is UB, not just "must not be used",
- add the explicit note that offsetting the old `ptr` (except by 0) is UB since it's derived from a freed allocation,
- fix the `Err`-branch to use the proper `[*invalidated*]` link for consistency.

`grow_zeroed` doesn't have its own copy of this paragraph (its docs just say "Behaves like `grow`"), so no change was needed there.

I didn't find a `gh`/network-shaped way to comment on the issue or open a PR from this sandbox (outbound network to `api.github.com` is blocked), so the fix is staged locally as an uncommitted diff — let me know if you'd like me to commit it and/or push a branch/PR.
