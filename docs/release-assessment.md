# v11.8.5 release validation

Combat details now show HP controls, Status conditions, the expanded visual stat block, live resources and encounter notes in that order. This release only reorders the existing conditions/stat-block sections. The compact numerical fields, health thresholds, HP adjustments, collapse behavior and left initiative/order/overview remain unchanged.

Validation: formatting, lint, TypeScript/production build and the existing Combat HP and live-resource/condition browser regressions. No new tests were added for this presentation-only reorder. The preceding v11.8.4 passed all 136 unit/integration tests and all 19 browser tests; those full suites are not claimed as rerun for this patch.

Browser checks use system Chromium. No API, schema or runtime dependency change is introduced. No fresh Debian installation, live-host deployment or offline-container smoke rerun is claimed for this patch. Existing operational and security requirements remain documented in [operations](operations.md) and [security notes](security-efficiency-review.md).
