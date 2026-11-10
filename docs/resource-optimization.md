# Resource-optimization refactor — 2026-11-10

Release v12.1.4 starts from restored v12.1.3. It preserves the local-only architecture, bundled production dependencies, existing user/admin functionality, schema 3, API formats, permission/revision checks, resource limits and installer/updater behavior. It does not reinstate the withdrawn v12.2.0 release or introduce new public-hosting settings. The development minimatch update described below keeps release verification and GUI preparation passing.

## Reduced work

Player/NPC, Session and Story filters now share a lazy search projection cache. Each immutable record's combined lowercase text, including plain-text notes, is extracted once while the record remains referenced. Subsequent search terms, queries and kind-filter changes reuse it. Edited records are replaced in state and therefore produce new projections. Empty queries and filtered-out record kinds avoid extraction. Weak keys permit unused records to be collected instead of retaining an unbounded ID-based cache. This trades some memory for live, searched records against repeated CPU work; it is not a claim that every screen uses less memory.

Story loading retrieves records and ordered Session IDs in one SQLite statement. The correlated aggregation uses the existing `(story_beat_id, session_id)` primary key. JavaScript no longer makes one database call per Story record or creates a relationship object per link. Empty links, campaign isolation, row ordering and child-ID ordering are preserved. Collection sizes and access controls are unchanged.

Player, Session and Story creates/updates sanitize their rich text once and reuse that output for both storage and screenshot references. This removes a second parse of identical input without changing the sanitization policy or search-index inputs. Read-only rich-text components memoize their sanitized HTML by content and hydration state; changing content still sanitizes it. Image expansion, editing and paste behavior are retained.

## Measurements

A synthetic, in-memory SQLite fixture on Node 24.19.0 compared the restored source against the refactor. Seven warm runs produced these local medians; timings vary with hardware, data and concurrent work.

| Workload                                                             | Before                                   | After                                 |
| -------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------- |
| 5,000 Story records with 10,000 Session links                        | 39.0 ms; 5,001 content/link driver reads | 30.7 ms; one content/link driver read |
| Five successive matching queries over 1,000 rich-text roster records | 9,000 plain-text extractions             | 1,000 extractions                     |
| Same roster queries with a warm projection cache                     | 80.5 ms                                  | 0.45 ms                               |
| Rich-text parsing per Player/Session/Story save                      | Two sanitizations                        | One sanitization                      |

Both benchmark implementations returned identical records/results. The warm-cache search measurement excludes first-use extraction, server requests, React painting and editor work. These are targeted measurements, not whole-application latency or memory guarantees. WeakMap collection timing depends on garbage collection.

## Validation and limits

Frozen-lockfile installation, formatting, ESLint, TypeScript, all **165 unit/integration tests**, the dependency audit gate, the production build and all **21 browser regressions** passed. New regressions verify search extraction reuse, immutable edit refresh, filters/literal matching, constant Story read-call count, empty/ordered links, campaign isolation and link cleanup after Session deletion. Existing browser coverage exercises Player/NPC creation, drafts, typed search, Session/Story workflows, prepared encounters, Combat, imports/stat blocks/tokens, Administration, navigation and offline operation.

Release preparation updates modern development minimatch to 11.0.1 for GHSA-g3hv-75wg-m249. A fresh raw registry audit reports zero advisories after this update, so no legacy advisory exception is needed or added. The existing audit policy and verified braces depth-patch handling remain unchanged. Other findings and registry failures still block. `pnpm verify` passes with the updated lockfile.

Validation used disposable local data and system Chromium. The live website/LXC, real installation/update services and Docker were not changed or exercised for this refactor. No claim is made that every possible workflow or production-sized dataset was tested.
