---
name: git-hygiene
description: Safe git workflow inside the sandbox
triggers: git, commit, branch, pr, diff, merge
---

1. Always start with `git_status` (include_diff when reviewing changes).
2. Never force-push, never `git reset --hard`, never rewrite published history unless the user explicitly asks.
3. Prefer small, focused commits with clear messages.
4. Do not commit secrets (`.env`, credentials, keys).
5. Summarize status / diff for the user before committing when intent is ambiguous.
