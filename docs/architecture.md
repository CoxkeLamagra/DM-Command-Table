# v11 architecture

The application uses Next.js 16, React 19, TypeScript, Tailwind/shadcn components and Node 24's built-in SQLite driver. One instance owns one data directory. The supported schema is version 2, built on version 1 `offline-runtime-baseline` with the `monster-token-section` migration. Identity is checked before initialization; unsupported storage is rejected without historical conversion.

## Source ownership

| Directory              | Responsibility                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `app/`                 | Pages and thin HTTP adapters                                                                                                         |
| `components/`, `lib/`  | Shared UI primitives, styling helpers and application version                                                                        |
| `features/`            | Workspace, section screens, editors and local drafts                                                                                 |
| `features/shared/api/` | Focused identity, campaign, content, preparation, Bestiary, combat, administration and media clients with shared transport/errors    |
| `domain/`              | Record types, combat rules/resources, prepared preview, limits, drafts and planning                                                  |
| `server/api/`          | Authorized resource routing and shared request context                                                                               |
| `server/content/`      | Player, Session and Story repositories, composed through a small facade with shared indexing, audit, timestamps and revision helpers |
| `server/`              | Campaign access/copies/packages, Bestiary, encounters, identity, administration, media and security                                  |
| `db/`                  | v11 schema, SQLite connections, prepared statements and transactions                                                                 |
| `scripts/`             | Build/start, packaging, shared storage resolution, backup/restore/maintenance and output cleanup                                     |
| `deploy/debian-13/`    | Fresh installer, guarded resume, systemd/Nginx and independent GUI update broker/build/deployment                                    |
| `tests/`               | Unit/API, browser, package, deployment and installer regressions                                                                     |
| `vendor/`              | Required upstream stylesheet/license                                                                                                 |

The content and encounter facades compose repositories without owning their SQL. `server/encounters/prepared-repository.ts` owns prepared encounters; `combat-repository.ts` owns authorized save/undo commands; `combat-storage.ts` owns live-state reads, combatant replacement and history pruning. `server/support/resource-persistence.ts` shares indexing, revision checking, campaign timestamps and audit events. Browser transport handles timeouts, connectivity, conflicts and mutation broadcasts. UI drafts are scoped to account/campaign, survive in-flight saves and reconcile revisions. Navigation supports addressable records and responsive sidebar state.

## Persistence and authorization

SQLite stores accounts, current-format password hashes, sessions, campaign ownership/sharing, records, prepared encounters, live combat/Undo, settings, templates, rate budgets, screenshot references, audit and FTS5 search. Owner/editor/viewer rights are checked at repository boundaries. Owners control sharing/transfer/deletion; viewers cannot mutate.

WAL, foreign keys and bounded busy timeouts are enabled. A connection-scoped LRU holds up to 256 prepared statements; bindings, data and authorization are evaluated afresh. Immediate transactions and nested savepoints protect compound writes. Session/preparation saves, bulk deletion and auth budget charging are atomic. Expected revisions reject stale writes rather than silently overwriting.

`server/content/persistence.ts` shares search indexing, campaign revision/audit updates and timestamps. Screenshot references change in the same transactions as content. Rich text is sanitized on writes, rendering and paste. Media access checks authorization even for conditional reads.

## Combat and preparation

Combat snapshots capture source stat blocks; runtime tracks HP, temporary HP, concentration, death saves, resources and condition timing/save prompts separately from reusable definitions. Live spending never changes Bestiary/prepared records. Saves, commands, Undo, scoped draft recovery and portable packages retain runtime state.

Loading replaces every current combatant, resets round/turn and creates fresh copies. Player names are trimmed/case-insensitive; the last prepared entry wins. Monsters/NPCs remain separate. Preview, capacity checks and loading share this rule. Direct saves reject repeated Player names. Empty preparation clears Combat; loading remains revision-checked and undoable. Expansion is limited to 10,000 combatants.

## Storage and packaging

`scripts/storage-config.mjs` resolves paths for the server and packaged storage/backup/maintenance commands. Relative paths resolve from the working directory; production should export absolute paths. SQLite defaults to `data/dm-command-table.sqlite`, with uploads/backups beside it.

Build creates `.next/standalone` plus static/public assets. Packaging copies the complete runtime and required operational scripts/storage helper, then writes a manifest. The independent verifier checks the v11 baseline, exact inventory, bounded SHA-256 hashes and contained relative links. Packaging uses that inventory traversal rather than a separate link validator. Bundled libraries require no package manager at runtime.

`pnpm clean` removes rebuildable outputs and TypeScript-generated files. It preserves source, data, credentials, dependencies and external symlink targets.

## Catalogue and deployment

The import window connects automatically to the fixed catalogue origin, without cookies/referrers. Index/record validation, download limits, source caching and cancellation bound remote work. Null ability sections and choice creature types are supported. Imports create local campaign records; local JSON works when remote requests fail.

The Debian installer provisions prerequisites as root, builds as `dmct-build`, deploys verified root-owned code and gives `dmct` write access only to application data. Shared pnpm is publicly executable; tokens remain root-only. Resume accepts only pre-deployment failures without data deletion. Runtime-user readiness checks confirm direct/proxy health, protected endpoints and updater access before token output.

The independent GUI updater resolves the newest stable v11 tag from the fixed project repository. A fresh unprivileged checkout installs locked dependencies and runs audit/format/lint/type/unit/build/browser/package checks without production storage/bootstrap settings. Root verifies, takes a stopped-service backup, switches releases and checks the expected health version. Failure restores matching code/data; preparation failure leaves the live application running. Manual staged packages remain an offline option. Docker lifecycle is host-managed.

## Verification

CI/deployment use Node 24 and pinned pnpm. Formatting covers source, deployment JavaScript, configuration and documentation, excluding generated output and retained vendor source. Unit/API/browser suites check functionality, authorization, revisions and drafts; package/backup/installer/deployment regressions check integrity and recovery. Actual systemd/Nginx/TLS/firewall acceptance remains a deployment-host check; see [release validation](release-assessment.md).

## Visual monster stat blocks

Import results offer **View stat block** before selection. Opening a Bestiary monster shows the same local parchment-style block with AC, HP, speed, ability scores/modifiers, traits/actions and spellcasting. Core fields and rich text remain editable through the existing Bestiary controls. Combat displays the independently captured encounter snapshot, so later Bestiary edits do not change a live encounter's block. All views render locally and remain available offline.

New imports retain alignment, armor/HP formula details, saving throws, skills, damage/condition defenses, senses, passive Perception, languages and full spell lists in the existing ability/spell fields. Existing saved records render their available fields immediately; reimport with replacement adds catalogue details that older imports did not retain. Existing combat snapshots keep their captured values. Stat blocks render locally without embedding the catalogue webpage.

Monster token icons appear at the upper right of visual stat blocks. Available tokens are downloaded from the catalogue during import and saved to the existing local image library; Bestiary and captured Combat blocks display these images offline. Reimport older monsters with replacement enabled to add tokens. Missing/unavailable token images do not block monster import. Token previews use temporary browser images. Both Bestiary and Combat stat blocks start expanded; click **Visual stat block** to collapse or expand them.

Monster token images have a dedicated `token` rich-text field. Bestiary persistence and Combat snapshots track this field through the existing local media reference and campaign package lifecycle. Schema migration 2 moves existing leading marked monster tokens from `abilities` to `token` without changing image URLs.

Bestiary listing loads tags once for the campaign rather than per monster. Bestiary writes sanitize rich-text fields at the repository boundary and reuse those values for persistence, indexing and media references. Ability-score images receive the same media reference tracking as tokens/actions/spells/notes.

`domain/local-media.ts` defines local image URL and reference parsing rules for browser/server use. `features/bestiary/catalogue-download.ts` owns catalogue-origin validation, credential-free fetch options, timeout/abort handling, streaming size limits and rejected-body cancellation. Token caching coalesces active downloads, retries transient failures and limits retained bytes to 16 MiB across at most 32 entries.

Revision-error lookups are scoped to the requested campaign; prepared records are scoped through their parent session. The failed-write path cannot return another campaign’s revision metadata.

## Request admission and local resource budgets

API routes share one decoded segment representation across dispatch, persistent rate limits and package concurrency admission. Prefetch and ordinary HTML share nonce CSP. Cookie selection supports HTTPS reverse proxies and HTTP LAN clients. Database transactions enforce local growth reserves; SQLite page limits cover direct allocations. Account campaign/record budgets and administrator storage metrics use the same host-configured limits. See [operations](operations.md) for defaults and deployment boundaries.
