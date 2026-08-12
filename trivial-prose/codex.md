[Fixture](scenario.json) · [Setup patch](setup.patch) · [Run metadata](codex.meta.json)

❯ Jack Huey is reviewing this. Fix the broken UI-test link in the rustc-dev-guide.

⏺ I’m checking the rustc-dev-guide link target and whether this is a trivial Markdown-link repair or something that would require broader doc changes. If it’s a straight link fix, I’ll patch that and verify the target exists.

<details>
<summary>⏺ Command</summary>

```console
/bin/zsh -lc "rg -n \"UI-test|ui-test|UI test|tests/ui|rustc-dev-guide\" src/doc/rustc-dev-guide -g '*.md' -g '*.mdx'"
```

</details>

⏺ I found a likely typo in the UI-test docs, but I’m verifying the exact broken reference before touching anything. The goal is to keep this to a single link correction if that’s all it is.

<details>
<summary>⏺ Commands (2)</summary>

```console
/bin/zsh -lc "sed -n '1,120p' src/doc/rustc-dev-guide/src/tests/adding.md"
```

```console
/bin/zsh -lc "sed -n '1,120p' src/doc/rustc-dev-guide/src/tests/ui.md"
```

</details>

⏺ The break is exactly what it looked like: `u.md` in [src/doc/rustc-dev-guide/src/tests/adding.md](about) points at a non-existent page, while the guide’s actual file is `ui.md`. I’m making the minimal link fix now.

⏺ Edit(file)

⏺ The edit is in place. I’m doing a quick verification pass that the target file exists and the old broken path doesn’t, so this stays a pure link repair.

<details>
<summary>⏺ Commands (3)</summary>

```console
/bin/zsh -lc 'test -f src/doc/rustc-dev-guide/src/tests/ui.md && echo exists'
```

```console
/bin/zsh -lc 'test -f src/doc/rustc-dev-guide/src/tests/u.md || echo missing'
```

```console
/bin/zsh -lc 'git diff -- src/doc/rustc-dev-guide/src/tests/adding.md'
```

</details>

⏺ The first patch accidentally disturbed the bullet indentation. I’m restoring that so the rendered list structure stays unchanged.

⏺ Edit(file)

⏺ The content is back to the original list shape. I’m doing one last diff check to confirm the only remaining change is the link target itself.

<details>
<summary>⏺ Command</summary>

```console
/bin/zsh -lc 'git diff -- src/doc/rustc-dev-guide/src/tests/adding.md'
```

</details>

⏺ Fixed the broken UI-test link in src/doc/rustc-dev-guide/src/tests/adding.md.

Changed:
- `u.md` -> `ui.md`

I verified:
- src/doc/rustc-dev-guide/src/tests/ui.md exists
- `src/doc/rustc-dev-guide/src/tests/u.md` does not

No test suite was run; this was a one-line doc link repair.
