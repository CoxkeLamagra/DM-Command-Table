# Local API reference

This is the current v9 route surface, derived from the route adapters and `server/api/api-router.ts`. It is an application API, not a compatibility promise for earlier releases. JSON requests use `Content-Type: application/json` and the local session cookie. Mutating requests with an Origin must match the browser-facing Host. Authenticated JSON responses are private and uncached.

Records use UUID IDs. Revisioned updates submit the last received `revision`; a stale revision returns a conflict. Read the current state and reconcile the draft before resubmitting. Input shapes and limits are defined in `server/http/schemas.ts` and `domain/`; the browser client is in `features/shared/api-client.ts`.

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

Prepared encounters are nested under Sessions; there is no top-level `C/encounters` CRUD route. Combat commands include submitted drafts so actions retain current edits.

## Identity, administration and media

| Method                   | Route                  | Purpose                                                                                |
| ------------------------ | ---------------------- | -------------------------------------------------------------------------------------- |
| GET                      | `/api/auth`            | Current user and registration/setup state                                              |
| POST                     | `/api/auth`            | `action: login/register/logout`; production first registration requires bootstrapToken |
| PATCH                    | `/api/account`         | Rename account or change password with currentPassword/newPassword                     |
| GET, POST, PATCH, DELETE | `/api/admin`           | Administrator-only accounts, registration and server settings; DELETE uses query `id`  |
| GET, POST                | `/api/screenshots`     | List accessible images or multipart upload                                             |
| GET, DELETE              | `/api/screenshots/:id` | Read or authorized deletion of a local image                                           |
| GET                      | `/api/health`          | Public readiness and version                                                           |

Typical errors are 400 for invalid input, 401 for missing/invalid authentication, 403 for forbidden operations or origin mismatch, 404 for missing resources, 409 for conflicting state and 429 for rate limits. Exact status and error text depend on the route. Do not expose cookies, passwords or bootstrap tokens in logs or exports.
