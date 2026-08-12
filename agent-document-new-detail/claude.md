[Run metadata](claude.meta.json)

❯ Jieyouxu Hu is reviewing this. Add to AGENTS.md that bootstrap tests must be run with `./x test bootstrap --stage 2`.

<details>
<summary>⏺ Command</summary>

```console
find . -maxdepth 2 -iname "AGENTS.md"
```

</details>

<details>
<summary>⏺ Read — <code>./AGENTS.md</code></summary>

```json
{
  "file_path": "./AGENTS.md"
}
```

</details>

<details>
<summary>⏺ Commands (7)</summary>

```console
grep -rn "stage 2" src/doc/rustc-dev-guide/src/tests/running.md 2>/dev/null; grep -rln "test bootstrap" src/doc/rustc-dev-guide/src/ 2>/dev/null; grep -rn "test bootstrap" --include=*.md -r . 2>/dev/null | grep -v target
```

```console
grep -rn "bootstrap" src/doc/rustc-dev-guide/src/tests/running.md | head -30; echo ---; find src/bootstrap -iname "*.md" | xargs grep -ln "stage 2" 2>/dev/null; echo ---; grep -rn "x test bootstrap" . --include=*.md 2>/dev/null -l 2>/dev/null; find . -maxdepth 3 -iname "*.md" | xargs grep -ln "test bootstrap" 2>/dev/null
```

```console
grep -rn "bootstrap" src/doc/rustc-dev-guide/src/tests/running.md | head -30
```

```console
find . -maxdepth 3 -iname "*.md" 2>/dev/null | xargs grep -l "test bootstrap" 2>/dev/null; find src/bootstrap -iname "*.md" 2>/dev/null
```

```console
grep -n "test bootstrap\|stage" src/bootstrap/README.md
```

```console
sed -n '210,235p' src/bootstrap/README.md
```

```console
grep -rn "test bootstrap" src/doc/rustc-dev-guide/src/ 2>/dev/null; grep -rn "bootstrap.*stage 2\|stage 2.*bootstrap" src/doc/rustc-dev-guide/src/ 2>/dev/null; grep -rn "x test bootstrap" src/ci/ 2>/dev/null
```

</details>

⏺ No existing human-facing documentation says bootstrap tests must be run with `--stage 2`. Per AGENTS.md's own rule (Prohibited text section):

> Before adding process or workflow guidance, locate that source. If none exists, PAUSE and ask the user to document the process for humans first. Do not make an agent file the sole source of a rule.

I checked `src/bootstrap/README.md` (the human-facing doc for bootstrap testing) — it only says `x test bootstrap`, with no `--stage 2` requirement, and I found no other doc (rustc-dev-guide, CI config) stating this either.

So I can't add this to AGENTS.md as a new rule sourced only from this conversation — that would make AGENTS.md the sole source of the rule, which the file itself prohibits.

Two options:
1. You (or someone) first document this requirement in `src/bootstrap/README.md` (or another human-facing doc), and I then add a linking/summarizing entry to AGENTS.md.
2. You confirm this is already documented somewhere I missed — point me to it and I'll add the AGENTS.md entry right away.

Which would you like to do?
