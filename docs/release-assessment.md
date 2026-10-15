# v11.9.0 release validation

Prepared encounters open immediately after creation. Save, Delete and Load encounter remain in the card header when collapsed. Each session displays encounters as consecutive numbers starting at 1. Collapsed cards can be reordered with drag handles or keyboard/touch up/down controls; ordering saves automatically while unrelated draft content remains unsaved.

A new bounded reorder endpoint requires campaign edit permission and the complete session encounter inventory with expected revisions. It updates order/revision/timestamps in one transaction and rejects stale, duplicate, missing or foreign selections atomically. Existing `sortOrder` storage provides ordering; no schema migration or runtime dependency is required. Load previews, Combat roster replacement, draft recovery and existing user/admin permissions remain supported.

## Executed checks

The full dependency audit gate, formatting, lint, TypeScript, 137 unit/integration tests and production build passed. Repository regressions verify atomic ordering, revision conflicts, rollback, cross-session selections, viewer rejection and content preservation. Browser checks cover immediate expansion, collapsed Save/Delete/Load controls, actual drag-and-drop, persistence after reload, keyboard reordering and preservation of dirty encounter content through reordering and in-flight saves. Existing campaign NPC, session-play, Combat and other browser workflows are also checked.

Prepared encounter headers and numbering were visually inspected on desktop/mobile. The ordering endpoint and one-based UI numbering are documented in the API and user guides.

## Validation limits

Browser checks use system Chromium. No fresh Debian installation, production deployment or live-host reassessment is claimed. The broad offline container smoke check passed for v11.8.1 and was not repeated for this feature. Existing deployment and security requirements remain documented in [operations](operations.md) and [security notes](security-efficiency-review.md).
