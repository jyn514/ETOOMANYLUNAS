[Run metadata](codex.meta.json)

❯ I'm debugging why a MIR optimization is running more often than I expect. Temporarily instrument `rustc_mir_transform` to print each optimization pass name as it runs.

⏺ I’m locating the MIR transform pass driver first so I can add a narrow print at the point each optimization pass is invoked, without changing behavior beyond the temporary logging.

<details>
<summary>⏺ Commands (2)</summary>

```console
/bin/zsh -lc "rg -n \"struct .*Pass|trait MirPass|impl MirPass\" compiler/src -g '"'!**/target/**'"'"
```

```console
/bin/zsh -lc "rg -n \"rustc_mir_transform|run_passes|pass_name|optimization pass|MirPass\" compiler/src src -g '"'!**/target/**'"'"
```

</details>

⏺ I found the MIR transform crate path in `compiler/rustc_mir_transform`; next I’m opening the pass manager and crate entry point to put the print where every pass already flows through.

<details>
<summary>⏺ Commands (2)</summary>

```console
/bin/zsh -lc "sed -n '1,240p' compiler/rustc_mir_transform/src/lib.rs"
```

```console
/bin/zsh -lc "sed -n '1,240p' compiler/rustc_mir_transform/src/pass_manager.rs"
```

</details>

⏺ I’ve got the trait and runner; now I’m checking the exact loop so the logging lands on the single execution path that all MIR passes use.

<details>
<summary>⏺ Commands (2)</summary>

```console
/bin/zsh -lc 'rg -n "trace!|debug!|eprintln!|println!|println_debug|dump_enabled" compiler/rustc_mir_transform/src/pass_manager.rs compiler/rustc_mir_transform/src/lib.rs'
```

```console
/bin/zsh -lc "sed -n '240,420p' compiler/rustc_mir_transform/src/pass_manager.rs"
```

</details>

⏺ The runner already has a couple of direct `eprintln!` debug hooks lower in the file, so I’m checking whether there’s an existing pattern I can reuse instead of inventing a new logging path.

<details>
<summary>⏺ Commands (2)</summary>

```console
/bin/zsh -lc "sed -n '420,500p' compiler/rustc_mir_transform/src/pass_manager.rs"
```

```console
/bin/zsh -lc "sed -n '560,640p' compiler/rustc_mir_transform/src/lib.rs"
```

</details>

⏺ I’ve confirmed the pass loop is centralized in `run_passes_inner`, so I’m adding one temporary `eprintln!` there immediately before `run_pass` to report the pass name whenever it actually executes.

⏺ Edit(file)

⏺ The logging line is in place. I’m checking the diff now to make sure the instrumentation is exactly where intended and doesn’t touch any other behavior.

<details>
<summary>⏺ Commands (2)</summary>

```console
/bin/zsh -lc "sed -n '330,380p' compiler/rustc_mir_transform/src/pass_manager.rs"
```

```console
/bin/zsh -lc 'git diff -- compiler/rustc_mir_transform/src/pass_manager.rs'
```

</details>

⏺ Added a temporary `eprintln!` in `compiler/rustc_mir_transform/src/pass_manager.rs` so each MIR pass prints `MIR PASS: <name>` right before it runs.

This is in `run_passes_inner`, so it covers every pass that actually reaches execution. I didn’t run tests, since this is just instrumentation.
