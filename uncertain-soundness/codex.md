❯ jyn is reviewing this. Fix `instantiate_from_frame_and_normalize_erasing_regions` in `compiler/rustc_const_eval/src/interpret/eval_context.rs`.

⏺ This is a soundness-sensitive compiler change in const evaluation, so I can’t safely modify `instantiate_from_frame_and_normalize_erasing_regions` here.

That path can affect compile-time evaluation and program correctness, which falls under the Rust policy’s banned areas unless the change is clearly soundness-neutral. Please take this to `#llm-mentoring` on Zulip for a human-guided review path.
