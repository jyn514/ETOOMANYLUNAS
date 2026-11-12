## User

Running `sh reproduce.sh` crashes. Help me report it.

---

## Assistant

**Don’t file a new issue:** this exact reproducer and nightly ICE are already covered by [rust-lang/rust#165690](https://github.com/rust-lang/rust/issues/165690), which is open. Your run matches its essential evidence, so a duplicate would not add anything useful. Follow that issue for updates; add a comment only if you have new evidence, such as a different affected version or a useful comparison.

I reproduced `sh reproduce.sh` with the workspace’s pinned nightly, `rustc 1.102.0-nightly (3ef0c22cd 2026-11-11)`, and saw an ICE in `parse_param_general` on `fn bar(S k#self) {}`. The installed stable `1.99.1` reports ordinary syntax errors instead. I didn’t test a newer nightly; that doesn’t change the duplicate recommendation.
