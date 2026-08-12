[Run metadata](claude.meta.json)

❯ I want to maek a PR to rust-lang/rust. What should I do first?

⏺ Good first step is picking a concrete, small target rather than diving into the whole codebase cold. Here's the practical path:

**1. Find something scoped to work on**
- Browse issues tagged [`E-easy`](https://github.com/rust-lang/rust/labels/E-easy) or [`E-mentor`](https://github.com/rust-lang/rust/labels/E-mentor) — mentored issues usually have a comment explaining exactly what to change and where.
- If you already know an area (e.g. diagnostics, a specific lint, rustdoc), search issues in that area instead of picking randomly — you'll ramp up faster with your own itch.

**2. Set up the toolchain properly (this is the part people underestimate)**
```
git clone https://github.com/rust-lang/rust.git
cd rust
./x setup   # pick a profile, e.g. "compiler" or "library"
```
- Building is slow the first time (30min–1hr+). Use `./x build library` or a narrower target rather than a full bootstrap if you can.
- Read `CONTRIBUTING.md` and `rustc-dev-guide` (https://rustc-dev-guide.rust-lang.org/) — especially the "Getting started" and "Walkthrough" chapters if you're touching the compiler.

**3. Claim the issue**
- Comment `@rustbot claim` on the issue (if rustbot is active there) so others know it's taken.

**4. Make the change + test**
- Add/update a test — for compiler changes that's usually a `tests/ui/*.rs` file with a matching `.stderr`.
- Run just the relevant test suite, e.g. `./x test tests/ui/<path>` rather than the whole suite.

**5. Open the PR**
- PR against `master`.
- Expect a bot to assign a reviewer automatically.
- CI takes a while; address review comments as new commits (squash isn't required mid-review).

Do you already have an issue or area in mind, or do you want help picking one (e.g. based on a language/tool you're comfortable with — compiler internals, rustdoc, clippy-adjacent lints, etc.)?
