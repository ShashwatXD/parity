---
name: debugging
description: Systematic debugging when something fails
triggers: error, fail, stack, debug, broken, exception
---

1. Reproduce with the smallest command in `terminal`.
2. Capture the exact error text; `grep` for the message / symbol.
3. Form one hypothesis; change one thing; re-run.
4. If stuck after two identical failures, broaden search (related files, recent diffs) instead of retrying.
5. Report root cause + fix + verification command.
