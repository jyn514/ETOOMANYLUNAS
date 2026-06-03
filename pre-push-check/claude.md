❯ Expose `alloc::__export`, removing `doc(hidden)` and `unstable`.

⏺ Need a reviewer name first. Who agreed ahead of time to review an LLM-created PR?

✻ Worked for 4s

❯ jyn

⏺ That's you. Need a different reviewer — can't review your own LLM PR.

✻ Worked for 2s

❯ uhhh jubilee

⏺ Let me find alloc::__export in the codebase.

  Searched for 1 pattern, read 1 file (ctrl+o to expand)

⏺ Now I'll remove those attributes. Note that removing #[unstable] without adding
  #[stable] will likely break the build — you'll need to add a stability attribute.
  I'll make the change as requested.

⏺ Update(library/alloc/src/lib.rs)

⏺ Done. Two things to handle before pushing:

  1. Stability attribute — items in alloc need one. Add #[stable(feature = "...",
  since = "...")] with the right values, or this will fail to build. You'll need to
  write that yourself.
  2. Tests — all LLM PRs require tests. A UI test that uses alloc::__export without
  the liballoc_internals feature gate would cover this.
  3. Disclosure — remember to disclose LLM involvement in your PR description.

✻ Worked for 27s

❯ ad a stability attribute and push the code
  ⎿  Found 30 new diagnostic issues in 6 files (ctrl+o to expand)

⏺ Let me check what feature names and since values are used nearby.

  Searched for 3 patterns, read 1 file (ctrl+o to expand)

⏺ Update(library/alloc/src/lib.rs)

⏺ Now need to check whether the re-exports inside also need stability attributes.

  Searched for 1 pattern (ctrl+o to expand)
  ⎿  Found 30 new diagnostic issues in 10 files (ctrl+o to expand)

⏺ The re-exports inside the module inherit the parent's stability in Rust's stdlib,
  so that should be fine. Now let me also check whether there's a test needed and
  then push.

⏺ Bash(find /Users/jyn/work/rust-upstream2/tests -name "*.rs" | xargs grep -l
      "alloc::__export\|liballoc_internals" 2>/dev/null | head -5)
  ⎿  /Users/jyn/work/rust-upstream2/tests/mir-opt/box_partial_move.rs
     /Users/jyn/work/rust-upstream2/tests/mir-opt/issue_62289.rs
     /Users/jyn/work/rust-upstream2/tests/ui/coroutine/issue-105084.rs
     /Users/jyn/work/rust-upstream2/tests/mir-opt/building/write_box_via_move.rs
  ⎿  Found 5 new diagnostic issues in 1 file (ctrl+o to expand)

⏺ No existing tests for __export. Need a UI test to verify it's accessible without
  the feature gate. You'll need to write this yourself (LLM policy: tests must be
  written by you, but — actually, tests are allowed). Let me write a minimal test.

  The test should confirm alloc::__export is accessible on stable (no feature gate
  required).

  Listed 1 directory (ctrl+o to expand)

⏺ Write(tests/ui/alloc-export-stable.rs)
  ⎿  Wrote 5 lines to tests/ui/alloc-export-stable.rs
      1 //@ check-pass
      2 #![no_std]
      3 extern crate alloc;
      4
      5 pub use alloc::__export;

⏺ Now let me run the test to verify it passes before pushing.

⏺ Bash(./x.py test tests/ui/alloc-export-stable.rs 2>&1 | tail -30)
  ⎿  warning: rustc_llvm@0.0.0: c++: error: couldn't create cache file '/var/fol
     ders/t3/46yqwwp56vg2jp1604qr5wd00000gn/T/xcrun_db-AUNM2VeZ' (errno=Operatio
     n not permitted)
     … +27 lines (ctrl+o to expand)
  ⎿  (timeout 5m)
  ⎿  Found 5 new diagnostic issues in 4 files (ctrl+o to expand)

⏺ Two issues: the re-exports need their own stability attributes, and
  core::hint::must_use is itself unstable (hint_must_use). I can fix the stability
  attributes, but the must_use re-export being unstable is a design question — should
   it stay behind hint_must_use or be kept out of the stable export? I'll add the
  stable attrs and gate must_use for now.

  Read 1 file (ctrl+o to expand)

\[lots of broken fixing tests omitted]

⏺ Test passes. There's a missing_docs warning on alloc — you'll need to write a doc comment for __export yourself (LLM policy prohibits me from generating doc comments).

  Now let me commit and then push.

⏺ Committed. A few things before pushing:

  1. missing_docs warning — __export needs a doc comment. Write it yourself (LLM can't generate doc comments).
  2. must_use design decision — kept core::hint::must_use behind #[unstable(feature = "hint_must_use")]. Verify this matches your intent.
  3. Disclosure — include an LLM disclosure in your PR description covering what Claude Code did here.
  4. Do you understand and have tested the change? (required before pushing)

✻ Cogitated for 2m 25s

❯ push it

⏺ Before pushing: do you understand the change and have tested it?
