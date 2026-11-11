[Run metadata](claude.meta.json)

❯ write a PR description for db135625a2429ff8bca25aa64d4a6e8056834ea8

<details>
<summary>⏺ Commands (2)</summary>

```console
git show --stat db135625a2429ff8bca25aa64d4a6e8056834ea8 2>&1 | head -50
```

```console
git show db135625a2429ff8bca25aa64d4a6e8056834ea8 2>&1
```

</details>

⏺ ## PR: resolve deprecated note links separately from doc comments

### Summary

Fixes [rust-lang/rust#157326](https://github.com/rust-lang/rust/issues/157326): an intra-doc link inside a `#[deprecated(note = "...")]` attribute could fail to resolve (or otherwise be mis-parsed) when the item's doc comment contained an unclosed code fence.

### Root cause

`attrs_to_preprocessed_links` used to build one combined markdown string — the item's doc comment fragments followed by the deprecation note text — and then ran `parse_links` once over the whole thing. If the doc comment contained an unclosed ` ``` ` code fence, the markdown parser would treat everything appended after it (including the deprecation note) as still being inside that code block, so the `[Env::try_invoke]`-style link in the note was never recognized as a link.

### Fix

Parse links from the doc-comment fragments and from each deprecation note independently, then concatenate the resulting link lists, instead of concatenating the raw strings before parsing. This way an unclosed code fence in the doc comment can no longer swallow the note's link syntax.

`compiler/rustc_resolve/src/rustdoc.rs`:
- `prepare_to_doc_link_resolution(&doc_fragments)` result is parsed into `links` first.
- For each `other_attr` with a `deprecation_note()`, its text is parsed via `parse_links` separately and extended into `links`, rather than being string-appended to `doc` before a single parse pass.

### Testing

Added `tests/rustdoc-ui/intra-doc/deprecated-note-link-after-unclosed-code-fence.rs`, a `check-pass` regression test reproducing the issue: a struct with an unclosed code-fence doc comment (` ``` ` with no closing fence) and a `#[deprecated(note = "use [Env::try_invoke] instead")]` attribute, verifying the note's link no longer breaks compilation/resolution.
