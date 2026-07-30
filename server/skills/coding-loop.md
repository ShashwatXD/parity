---
name: coding-loop
description: Default coding agent playbook for Parity workspace work
triggers: code, fix, implement, refactor, bug, test, build
---

1. Clarify the goal in one sentence, then open `task_tracker` with a short plan (3–7 tasks).
2. Orient with `list_dir` / `glob` / `grep` before editing.
3. Prefer `file_editor` `str_replace` over rewriting whole files.
4. After edits, run the smallest relevant check via `terminal` (typecheck, test, or build).
5. Mark tasks done as you go; never leave the plan stale.
6. If a tool fails twice the same way, change strategy — do not loop.
