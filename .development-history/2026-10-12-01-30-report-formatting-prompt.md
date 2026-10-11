# Task

Improve the base system prompt so Agent-produced reports come out tidier.

## Summary

Added a `<report_formatting>` section to the Agent-mode system prompt. The
existing `<scan_methodology>` and `<finding_quality>` sections only covered what
to include and how to rate severity; nothing told the model how to lay a report
out in Markdown. The new section defines a consistent structure (overview,
findings-at-a-glance table, per-finding subsections, fenced code blocks,
consistent severity labels) and is scoped so simple/conversational answers skip
the scaffold.

## Changes

- `lib/system-prompt.ts`: new `<report_formatting>` block after `<finding_quality>` (Agent mode only).
- `lib/__tests__/system-prompt.test.ts`: assert the block is present in Agent mode and absent in Ask mode.

## Decisions

- Placed in Agent mode only, matching `<finding_quality>`/`<scan_methodology>` scope.
- Dropped an emoji clause to avoid duplicating the single "no emojis" rule in `<response_style>` (a test asserts it appears exactly once).

## Verification

- `jest lib/__tests__/system-prompt.test.ts`: 35 passed. The 4 remaining failures are from a concurrent, unrelated `HackerAI -> DiggerAI` rename in the same file, not this change.

## Limitations

- Not committed: `lib/system-prompt.ts` currently also holds another agent's in-progress brand rename that breaks brand-string tests. Avoided bundling their incomplete work into a commit.

## Follow-up

- Commit this change's hunks once the concurrent rename settles, or on request.
