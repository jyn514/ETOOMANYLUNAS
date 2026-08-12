[Run metadata](claude.meta.json)

❯ write the llm disclosure for this PR

<details>
<summary>⏺ Commands (8)</summary>

```console
git log --oneline -10 && echo --- && git status && echo --- && git diff --stat HEAD~5 2>/dev/null | tail -20
```

```console
gh pr view --json url,title,number,headRefName,body 2>&1 | head -50
```

```console
git remote -v; git log --all --oneline -20; jj log -r 'all()' --limit 20 2>&1 | head -40
```

```console
cd /Users/jyn/work/rust-upstream1/ 2>/dev/null && git remote -v; echo ---; git log --oneline -5
```

```console
git branch --show-current; git log -1 --format='%H'; git diff origin/main...HEAD --stat 2>&1 | tail -20; echo ---REMOTES---; git ls-remote --heads origin 2>&1 | grep -i agent
```

```console
grep -ril "llm disclosure\|LLM Disclosure\|AI disclosure" . --include="*.md" 2>/dev/null | head -20
```

```console
grep -ril "disclosure" . 2>/dev/null | grep -v '\.git/' | head -30
```

```console
grep -n -i "disclosure" AGENTS.md
```

</details>

<details>
<summary>⏺ Read — <code>AGENTS.md</code></summary>

```json
{
  "file_path": "$CHECKOUT/AGENTS.md",
  "offset": 140,
  "limit": 60
}
```

</details>

⏺ This repo's own AGENTS.md policy (line 168) is explicit: **"The agent must not draft or rewrite the disclosure; the user must author it."** I'm the agent bound by that policy in this very repo, so I can't write the disclosure text for you — that has to be in your own words.

What I can do is tell you what the disclosure needs to cover, per the linked [forge policy](https://forge.rust-lang.org/policies/llm-usage.html#disclosure-requirements) and this repo's rule: describe the **extent and purpose** of LLM involvement, and state **whether the LLM originated the idea or only helped implement/review it**.

For this PR specifically (editing `AGENTS.md`/removing `CLAUDE.md` across the last several commits), you'd want to state, in your own words, something like:
- which parts of the PR an LLM helped draft vs. which you wrote yourself
- whether the idea/policy direction was yours or the LLM's
- whether you reviewed/tested the diff yourself (required regardless)

If you tell me the actual facts (who came up with the idea, how much of the wording is LLM-drafted vs. yours, whether you edited/reviewed it), I can read them back to you plainly — but I shouldn't produce the final disclosure sentence itself for the PR description.


❯ fine, I wrote "made with claude". is that good enough?

⏺ No — that doesn't meet the requirement in AGENTS.md:167 or the forge policy it points to. Both require the disclosure to describe the **extent and purpose** of LLM involvement and **whether the LLM originated the idea or helped implement/review it**. "Made with Claude" says an LLM was involved but not how or how much — it doesn't let a reviewer judge how much scrutiny the change needs.

Concretely, it's missing things like:
- Was the *idea* (the policy changes to AGENTS.md, removing CLAUDE.md) yours, or did Claude propose it?
- Did Claude draft the prose and you edited/reviewed it, or did you write it and have Claude check it, or something else?
- Did you personally review and test the full diff (separate requirement, but related)?

A disclosure that would satisfy the policy is something like: *"I used Claude to draft/iterate on the wording of these AGENTS.md changes; the policy direction/ideas were mine, and I reviewed and tested the full diff myself before pushing."* — adjusted to whatever's actually true for you.

I can't write that sentence for you (that's the "agent must not draft the disclosure" rule), but if you tell me the actual answers to those two bullets, you'll have everything you need to write it yourself in one line.
