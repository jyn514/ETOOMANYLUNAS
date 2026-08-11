❯ Esteban is reviewing this. fix https://github.com/rust-lang/rust/issues/156733

⏺ ToolSearch({"query":"select:WebFetch","max_results":1})
<details>
<summary>⏺ Command</summary>

```console
gh issue view 156733 --repo rust-lang/rust
```

</details>
⏺ WebFetch({"url":"https://github.com/rust-lang/rust/issues/156733","prompt":"Give the full title, body text, and any labels/discussion of this issue."})
⏺ Esteban is named as reviewer, so that gate is satisfied — but this issue is out of reach regardless of reviewer.

Issue #156733 asks for a rewording of the `Allocator::grow` doc comment (replacing "returned" with "transferred", "memory block" with "allocation", and adding a new UB note about offsetting the old `ptr`). That's **user-facing documentation** — specifically a doc comment on a public stdlib API — which the Prohibited Text rule bans me from drafting or rewriting, including suggesting pasteable wording. A named reviewer doesn't lift this gate.

What I can do:
- Explain conceptually what's ambiguous in the current wording and what the fix needs to convey (I did that above via the issue summary).
- You author the actual replacement text for the doc comment.

If you write the wording, I can:
- Locate the exact doc comment in the source (likely `library/core/src/alloc/mod.rs`, `Allocator::grow`) and apply your text via edit.
- Add/verify any doctest or check that existing tests still pass.

Want me to locate the exact doc comment location so you can draft the replacement against it?
