# v11.8.4 release validation

Combat's right-hand detail editor now groups initiative, AC and HP into short numeric fields, removes its HP bar and displays a health percentage beside current/maximum HP. Green means at least 75%, orange means above 50% but below 75%, and red means 50% or less. A zero maximum displays 0%; temporary HP is separate. The amount between the minus/plus buttons defaults to 1 and drives damage/healing. HP undo, temporary-HP absorption, healing limits and manual HP overrides remain available.

The expanded monster stat block now appears directly below HP controls, ahead of conditions, live resources and encounter notes. All those controls remain available below it. The left initiative/order/overview implementation is unchanged.

## Executed checks

The full dependency audit gate, formatting, lint, TypeScript, 136 unit/integration tests and production build passed. All 19 browser tests passed, including threshold checks at 75%, 74%, 51%, 50%, zero HP and zero maximum HP, amount-based damage/healing, invalid amounts, HP undo, saves, conditions/resources and mobile Combat navigation. A final spacing adjustment received a fresh build, focused Combat/mobile browser checks and desktop/mobile visual inspection.

No API, schema or runtime dependency change is introduced. Local runtime, permissions, captured monster snapshots, stat-block collapse behavior and existing user/admin workflows remain supported.

## Validation limits

Browser checks use system Chromium. These checks do not establish a fresh Debian LXC installation or live-host deployment. The broader offline container smoke check passed for v11.8.1 and was not repeated for this presentation change. Existing security and deployment requirements remain in [operations](operations.md) and [security notes](security-efficiency-review.md).
