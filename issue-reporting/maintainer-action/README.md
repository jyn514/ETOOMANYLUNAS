# Maintainer-action trials

Test how effective the `rust-issue-reporting` skill is, using [`inspect`].
Disables networking and injects custom tools so that trials are reproducible.

Currently only "is this a duplicate?" and "is this already fixed?" are tested.
All recorded transcripts are generated with gpt-6-luna, but I also tested with 6.1-sol and 6-astra, and those work just as well or better.

**Note: all the text below this is LLM-generated.**
Skip to the table if you just want links to the transcripts.

[`inspect`]: https://inspect.aisi.org.uk/

## Cases and saved responses

Every sample starts with the same request:

> Running `sh reproduce.sh` crashes. Help me report it.

The script runs only the reporter's failing command; it does not compare versions or search reports.
The agent must gather that evidence itself.

| Sample | Compiler failure and archived upstream state | Reference recommendation |
| --- | --- | --- |
| [`fixed`](luna-fixed-on-nightly.md) | #165741 crashes 1.99.1, but the pinned nightly compiles it; no matching archived report. | No new issue. |
| [`duplicate`](luna-known-fixed-duplicate.md) | The same failure already has a closed record explaining the fix. | Neither file nor comment. |
| [`comment`](luna-additional-affected-edition.md) | #165690 also ICEs with edition 2021; its archived report only covers edition 2024. | Comment with the additional affected configuration. |
| [`new`](luna-unreported-parser-ice.md) | #165690 still ICEs; the archive contains only the unrelated, fixed LLVM report. | Recommend a new issue within this snapshot. |

The sample links contain the initial prompt and final assistant message from the `subscription/gpt-6-luna` run on November 12, 2026 at 17:53 UTC.
They omit tool calls and intermediate messages; they are observed responses, not the reference recommendations.
There is no automated grader.
References and source hashes are evaluator metadata, not model instructions.

## What the agent can discover

Only the input, command, and a short workspace README are staged in each sandbox.
The repository's current [Rust reporting skill](../../.agents/skills/rust-issue-reporting/SKILL.md) is available through Inspect's skill tool; the harness does not rewrite it per sample.
Upstream repository documentation, reporting guidance, and the selected issue record remain behind tools until the agent requests them:

- `search(query)` returns ranked titles, URLs, and text snippets from the frozen upstream corpus.
  It matches literal query text rather than returning the sample's reference recommendation.
  Filter-only searches such as `site:github.com/rust-lang/rust/issues/165741` return matching pages even without extra keywords.
- `open(url)` reads a requested page from that corpus.
  Unknown URLs mean the page was not archived, not that it is absent from live upstream.
- `clone(url, destination)` creates a real shallow Git checkout of the archived Rust repository on demand.

Shell networking is disabled.
The image caches a shallow Rust Git repository at commit `29a5d066d98b58d948d285ba22390a5f849f5938`, but does not pre-check out its files into the workspace.
Git URL rewrites point the Rust remote to that local archive, so ordinary Git commands work and Bash can also clone it.

### Snapshot limits

The compiler defects and toolchain outcomes are real; the tracker records are controlled offline excerpts, not complete live GitHub state.
In particular, `new` does not claim #165690 is actually unreported.
The runtime uses x86-64 Rust 1.99.1 and nightly-2026-11-12 as pinned snapshot versions, not a claim about the current nightly.
[Compiler evidence and provenance](source/PROVENANCE.md) records the sources, flags, and verified outcomes; the agent does not receive that document.

These trials test discovery and reporting through Inspect's archived tools, not real `gh`/browser behavior or a complete Internet simulation.
Other repositories and uncaptured pages remain harness-coverage gaps, not evidence of poor agent behavior.

## Run the trials

Docker and a configured Inspect environment are required.
The first image build fetches the archived Rust repository and the pinned compilers; it does not build the Rust compiler.

With the subscription provider already set up:

```sh
cd ~/src/personal/neo-interview
uv run --project inspect-subscription inspect eval \
  ~/src/llms/ETOOMANYLUNAS/maintainer_action.py@maintainer_action \
  --model subscription/gpt-6-luna
```

Or load [`maintainer_action.py@maintainer_action`](../../maintainer_action.py) from another configured Inspect environment.
Docker is the default sandbox; logs are written under the directory where Inspect runs.

## Check the harness

From this repository's root:

```sh
uv run python -m unittest discover -s tests
```

Mock-model tests exercise the real Inspect `search`/`open` tool loop without model requests or Docker.
The native compiler smoke test also runs when both pinned toolchains are installed in `RUSTUP_HOME`; otherwise it reports a skip.
The real-Git clone smoke test runs when `work/clone-cache/rust.git` is available, or `TRIAL_GIT_CACHE` names an archive; otherwise it reports a skip.
Docker prepares the pinned toolchains and repository archive itself.

Earlier CSV/Pi-worker evidence remains under `target/maintainer-action-trials/`; it is not evidence for these compiler samples.
