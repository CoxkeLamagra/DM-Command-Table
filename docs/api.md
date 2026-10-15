# Local API reference

This is the current route surface, derived from the route adapters and focused handlers under `server/api/`. It describes the supported v11 application. JSON requests use `Content-Type: application/json` and the local session cookie. Mutating requests with an Origin must match the browser-facing Host. Authenticated JSON responses are private and uncached.

Records use UUID IDs. Revisioned updates submit the last received `revision`; a stale revision returns a conflict. Read the current state and reconcile the draft before resubmitting. Input shapes and limits are defined in `server/http/schemas.ts` and `domain/`; the browser client is in `features/shared/api/`.

## Campaigns and content

`C` below means `/api/campaigns/:campaignId`.

| Method             | Route                                              | Purpose                                                              |
| ------------------ | -------------------------------------------------- | -------------------------------------------------------------------- |
| GET, POST          | `/api/campaigns`                                   | List accessible campaigns (`archived=true` optional) or create       |
| POST               | `/api/campaigns/import`                            | Import portable campaign JSON or an image-inclusive campaign package |
| GET, PATCH, DELETE | `C`                                                | Read, revisioned update or owner delete                              |
| POST               | `C/copy`                                           | Copy with `mode: "campaign"` or `"template"`                         |
| GET                | `C/export`                                         | Portable campaign JSON; image references only                        |
| GET                | `C/package`                                        | Self-contained campaign package with image assets                    |
| GET, POST          | `C/members`                                        | List sharing or grant/update access by username and role             |
| DELETE             | `C/members/:userId`                                | Revoke sharing                                                       |
| POST               | `C/members/transfer`                               | Transfer ownership to `userId`                                       |
| GET, POST          | `C/players`, `C/monsters`, `C/sessions`, `C/story` | List or create records; players include Player/NPC kind              |
| PATCH, DELETE      | Above routes plus `/:recordId`                     | Revisioned update or delete                                          |
| POST               | `C/players/bulk-delete`, `C/monsters/bulk-delete`  | Atomic deletion of selected `ids`                                    |
| POST               | `C/sessions/:sessionId/save`                       | Transactional session and prepared-encounter save                    |
| GET, POST          | `C/sessions/:sessionId/encounters`                 | List or create prepared encounters                                   |
| PATCH, DELETE      | `C/sessions/:sessionId/encounters/:encounterId`    | Revisioned update or delete                                          |
| GET                | `C/search?q=...&type=...`                          | Local search; type is all/session/story/player/npc/monster           |
| GET, POST          | `/api/templates`                                   | List or save personal templates                                      |
| DELETE             | `/api/templates/:templateId`                       | Delete a personal template                                           |

Owners control sharing, ownership transfer and campaign deletion. Editors can change campaign content; viewers can read. Templates and administration support are not additional cloud services.

## Combat

| Method   | Route                    | Purpose                                                                      |
| -------- | ------------------------ | ---------------------------------------------------------------------------- |
| GET, PUT | `C/combat`               | Read or revisioned save of active Combat                                     |
| POST     | `C/combat/command`       | Submit combat draft and next-turn/reset-rounds/remove-monsters/clear command |
| POST     | `C/combat/load-prepared` | Load prepared draft into active Combat using expected combat revision        |
| POST     | `C/combat/undo`          | Undo against current `revision`                                              |

Prepared encounters are nested under Sessions; there is no top-level `C/encounters` CRUD route. Combat commands include submitted drafts so actions retain current edits. The optional `zeroHpPolicy` accepts `skip-all` (default), `include-players`, or `include-all`; it controls eligibility for next-turn and reset-rounds. Invalid values return 400, and stale combat revisions return 409.

## Identity, administration and media

`GET /api/admin/updates` requires a current administrator session and returns `{ available, target?, job }`. An unavailable local broker returns `{ available: false, job: null }`. `POST /api/admin/updates` accepts only `{ "action": "start" }`, checks origin and current administrator rights, records the request in the local audit history and limits starts to six attempts per administrator/source per hour. A reachable broker returns 202 with the current job; an unavailable broker returns 503. Duplicate starts attach to the running job. Browser-supplied targets or commands are rejected with 400. Status and logs use private, uncached responses. The broker's root-configured target (latest stable v11 by default) and latest job are defined in `domain/updates.ts`; it runs independently of application restarts. See [Debian GUI setup](debian-13-lxc.md#updates-from-administration).

| Method                   | Route                  | Purpose                                                                                |
| ------------------------ | ---------------------- | -------------------------------------------------------------------------------------- |
| GET                      | `/api/auth`            | Current user and registration/setup state                                              |
| POST                     | `/api/auth`            | `action: login/register/logout`; production first registration requires bootstrapToken |
| PATCH                    | `/api/account`         | Rename account or change password with currentPassword/newPassword                     |
| GET, POST, PATCH, DELETE | `/api/admin`           | Administrator-only accounts, registration and server settings; DELETE uses query `id`  |
| GET, POST                | `/api/screenshots`     | List accessible images or multipart upload                                             |
| GET, DELETE              | `/api/screenshots/:id` | Read or authorized deletion of a local image                                           |
| GET                      | `/api/health`          | Public readiness and version                                                           |

Typical errors are 400 for invalid input, 401 for missing/invalid authentication, 403 for forbidden operations or origin mismatch, 404 for missing resources, 409 for conflicting state, 413 for size/storage budgets and 429 for rate limits. Exact status and error text depend on the route. Do not expose cookies, passwords or bootstrap tokens in logs or exports.

Combatants accept optional `runtime` and `snapshot` fields. Runtime contains nonnegative `temporaryHitPoints`, nullable `concentration`, `deathSaves` (integer successes/failures from 0 through 3), and up to 100 resources (`id`, `name`, `maximum`, `remaining`, `reset`). Resource counts are integers from 0 through 10,000 with remaining no greater than maximum; reset is `manual` or `start-turn`. A Bestiary-linked combatant captures its stat block and slot resources when first saved without a supplied snapshot/runtime. Prepared loads create fresh snapshots and resources per instance.

Conditions support `timing` (`start-turn`, `end-turn`, `manual`), `requiresSave` and `saveDue`. New timed conditions default to start-turn; indefinite conditions use manual timing. Turn commands decrement the outgoing end-turn and incoming start-turn conditions; save-gated expiry sets `saveDue` instead of removing the condition. Clients manually resolve saves and death saves. Own-turn resources reset only for the incoming eligible combatant, including round wrap. Reset-rounds changes round/turn without consuming conditions or restoring resources.

## Security and capacity behavior

Authentication user objects never contain password hashes or credential evidence. A login or password change racing a reset returns a failure rather than issuing a session from obsolete credentials. Administrator rights are rechecked at the account mutation boundary. Password work and campaign package import/export return 503 with a retry message when their process-local capacity is full; retry the operation after a short delay.

Screenshot GET responses stream bytes and use `Cache-Control: private, no-cache`, `Vary: Cookie`, and an ETag. `If-None-Match` can return 304 only after current user/campaign access is checked. Unauthenticated requests remain 401 and inaccessible/missing images remain 404.

Package imports require a valid current portable campaign and exactly its referenced image assets; missing, duplicate or unused assets reject before decoding. Imports remain transactional with staging cleanup; the 50 MiB package limit remains. Package concurrency is bounded before request-body reading. This changes rejection of malformed packages, not the supported export format.

## Offline imports and updates

Catalogue files are parsed and searched in the browser; selected monsters use the normal local `C/monsters` mutation endpoints. There is no server-side remote catalogue API. Optional catalogue search fetches JSON from `https://dnd5e.lamagra.link` directly in the browser when the import window opens, without credentials or referrers. Selected records still use the same local monster endpoints. The automatic updater uses the fixed project Git repository and resolves the root-configured target to an exact commit; default `latest` chooses the newest stable v11 tag. Its unprivileged build helper installs frozen dependencies, verifies/builds/tests and packages before root deployment. Manual host staging remains an optional offline mode. The update API retains administrator authorization, audit entries, throttling and polling, and cannot upload or choose executable code. First installation initializes the v11 database baseline.

Prepared encounter loading replaces the entire current roster, including Players and NPCs. Player names are unique after trimming and case-insensitive comparison; the last prepared entry wins. Monster/NPC duplicates remain separate. An empty prepared encounter clears combat. Direct combat saves reject repeated Player names atomically; normal revision checks and Undo remain available.

## Visual monster stat blocks

Import results offer **View stat block** before selection. Opening a Bestiary monster shows the same local parchment-style block with AC, HP, speed, ability scores/modifiers, traits/actions and spellcasting. Core fields and rich text remain editable through the existing Bestiary controls. Combat displays the independently captured encounter snapshot, so later Bestiary edits do not change a live encounter's block. All views render locally and remain available offline.

New imports retain alignment, armor/HP formula details, saving throws, skills, damage/condition defenses, senses, passive Perception, languages and full spell lists in the existing ability/spell fields. Existing saved records render their available fields immediately; reimport with replacement adds catalogue details that older imports did not retain. Existing combat snapshots keep their captured values. Stat blocks render locally without embedding the catalogue webpage.

Monster tokens use a separate optional `token` rich-text field on monsters and Combat snapshots (empty by default). The Bestiary editor displays the full image in **Token**, while the stat-block renderer displays it at the upper right. Tokens use authenticated `/api/screenshots` local media and the existing access/reference/quota policies. Schema migration 2 moves existing leading marked token images out of monster `abilities` into `token`; older captured Combat snapshots remain readable.

The v11.7 refactor preserves request paths, response shapes, revision/conflict codes and campaign permissions. Bestiary rich text is normalized once by the repository, including direct internal callers; the route validates the input schema. Local-only image rules and bounded catalogue downloads use shared helpers.

A record ID outside the campaign specified in the request returns `not_found` on failed content/prepared-encounter updates; revision metadata is only returned for records within that campaign.

## Admission and storage limits

Import/export route aliases receive the same rate and concurrency limits as canonical paths. Malformed encodings and extra import/package segments return 400. Storage or account budget violations return 413 with a public explanation; blocked mutations roll back. Administrator state includes storage usage and configured host limits. See [operations](operations.md) for budget configuration.
