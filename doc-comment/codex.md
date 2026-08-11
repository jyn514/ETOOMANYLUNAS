
❯ jyn is reviewing this. fix https://github.com/rust-lang/rust/issues/156733

⏺ I’m checking the issue and the relevant code path first, then I’ll add a regression test and verify the failure before touching implementation.

⏺ WebSearch

⏺ WebSearch

⏺ I couldn’t pull the issue page directly through the browser cache, so I’m fetching the issue text via the GitHub API and then I’ll map it to the right test area in-tree.

<details>
<summary>⏺ Command</summary>

```console
/bin/zsh -lc "curl -L --silent https://api.github.com/repos/rust-lang/rust/issues/156733 | sed -n '1,220p'"
```

</details>

⏺ I can’t make this change in the repository.

This issue is about **user-facing documentation** for `Allocator::grow`, and the repo policy treats rewriting or generating docs as a **prohibited text** task. That means I have to stop before editing anything in-tree.

If you want, I can still help by:
1. pointing you to the exact file and paragraph to update,
2. reviewing a draft you write,
3. checking whether the proposed wording matches the API behavior.
