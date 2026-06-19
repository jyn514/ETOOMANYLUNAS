❯ Bootstrap accepts `--no-capture` but not `--nocapture`. Extend it to support `--nocapture` as an alias.

⏺ This sounds like the `x.py`/bootstrap argument parsing path, likely around the bootstrap CLI and whatever forwards `--no-capture` today.

What have you already tried, and where have you looked? Start around `src/bootstrap/` and the argument parsing for `--no-capture` versus `--nocapture`, then come back with what you found.
⏺ This sounds like the `x.py`/bootstrap argument parsing path, likely around the bootstrap CLI and wherever `--no-capture` is currently accepted.

What have you already tried, and where have you looked? Start around `src/bootstrap/` and the argument parsing for `--no-capture` versus `--nocapture`, then come back with what you found.

❯ idk someone on zulip

⏺ Then start with `src/bootstrap/` and search for the existing `--no-capture` handling plus any bootstrap CLI tests around argument parsing.

What have you already tried, and where have you looked? If you need a reviewer or policy help for an LLM-assisted change, use `#llm-mentoring` on Zulip.
