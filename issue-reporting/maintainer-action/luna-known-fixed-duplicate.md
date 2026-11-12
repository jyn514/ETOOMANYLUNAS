## User

Running `sh reproduce.sh` crashes. Help me report it.

---

## Assistant

**Don’t file a new issue:** this exact reproducer is already covered by [rust-lang/rust#165741](https://github.com/rust-lang/rust/issues/165741), which is closed. The maintainer noted the problem was fixed in beta.

I reproduced the `SIGILL` from `sh reproduce.sh` on rustc 1.99.1. The same source and flags compile successfully with the installed nightly, rustc 1.102.0-nightly (2026-11-11). That matches the existing report’s resolution; no follow-up appears necessary.
