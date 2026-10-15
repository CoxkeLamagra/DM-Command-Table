# User guide

### Campaigns and sharing

- Create, switch between, and delete multiple campaigns.
- Store normalized campaign records in SQLite on the local application server.
- Export and import campaign records as portable JSON, or choose **Export with images** for a self-contained campaign package. Full server backups additionally preserve accounts and undo history.
- Copy a campaign as a complete independent campaign, including its players and progress.
- Copy a campaign as a reusable template that keeps campaign content, Bestiary records, Stories, Sessions, prepared encounters, and Story–Session links while excluding players and resetting progress.
- Share campaigns with another registered DM Command Table user by username.
- Assign **Editor** access for collaboration or **Viewer** access for read-only use.
- Detect same-browser changes immediately and poll revisions for changes from other devices.
- Manage the campaign name and general campaign notes from a dedicated **Campaign** screen.
- Use **Campaign actions** for access management, copying/templates, imports, exports, archiving and deletion. **Save** remains directly available.
- Continue an active session or prepare the earliest planned session directly from Campaign. Undated sessions follow dated sessions.
- Review a chronological campaign timeline generated automatically from session entries.
- Keep the Campaign screen focused with a 70% Campaign-details and 30% Timeline layout, with Session-note previews limited to 2,000 characters.
- Select a timeline entry to open and focus its corresponding session note.

Campaigns are private by default. Only the owner can share or delete a campaign. Owners and editors can save changes; viewers cannot modify campaign data.

### Administration sections

Administration opens **Update Application** and provides four tabs. The tab bar has a dark background, a yellow selected tab with black text, and gray inactive labels. Tabs wrap into two columns on small screens and support keyboard navigation. Switching sections retains unsaved settings/account fields and update progress while Administration remains open.

| Section                | Controls                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| Update Application     | Start an update, follow progress and read retained logs                                                    |
| Server Settings        | Cookie/session settings, screenshot quotas, retention and database storage metrics                         |
| Account Administration | Registration, account creation, usernames/display names, administrator roles, password resets and deletion |
| Screenshot Library     | Browse, upload and delete local screenshots                                                                |

### Local user administration

- The first locally registered account automatically becomes an administrator.
- Administrators can open **Administration** to review all registered accounts.
- With the optional Debian update service installed, administrators can update the application from **Administration**, follow executed steps and view the retained update log. See [GUI update setup](debian-13-lxc.md#updates-from-administration).
- Change usernames and display names, reset passwords, or delete accounts.
- Grant or remove administrator access for other users.
- Manage server-wide cookie security, session lifetime, screenshot upload and storage limits, Combat undo retention, and audit retention from the Web UI.
- Enable or disable self-registration from the Web UI.
- Create additional accounts directly from the Web UI.
- Password resets invalidate all active sessions for the affected account.
- Deleting an account also permanently deletes campaigns owned by that account.

An administrator cannot delete their own account or remove their own administrator access. These safeguards ensure that the server always retains at least one administrator.

### Combat tracker

- Give each encounter its own editable name.
- On smaller screens, switch between Initiative and Details; selecting a combatant or advancing its turn opens Details while retaining edits. Wide screens keep the split view.
- Add ad-hoc players, monsters, or NPCs.
- Use one Add combatants picker for the Campaign roster, Bestiary, and Single-use records. Keep selections across searches and source tabs, filter Players/NPCs, and enter monster quantities before adding.
- Add reusable Players and NPCs from the campaign roster, retaining their type, HP, AC, and notes.
- Add monsters from the campaign bestiary with their linked stat blocks.
- Assign optional numbers to Monsters and NPCs so identically named combatants remain easy to distinguish.
- Track initiative, turn order, rounds, armor class, current and maximum HP, and conditions.
- In the details pane, enter the amount between **−** (Damage) and **+** (Heal); the amount defaults to 1. Use the adjacent undo icon to undo the last HP change.
- Short numeric fields use compact widths. The health percentage beside HP is green at 75% or above, orange above 50% and below 75%, and red at 50% or below (including a zero maximum). Temporary HP is separate from this percentage. The details HP bar is removed; initiative order and overview remain unchanged.
- Status conditions appear below HP controls, followed by the monster’s expanded visual stat block, live resources and encounter notes.
- Keep Save and Next turn visible while scrolling. Reset and clear operations live in Encounter actions and explain their effects before confirmation.
- Highlight combatants at `0 HP` as downed and automatically skip them when advancing to the next turn.
- Reset the round counter without removing combatants.
- Remove all monster combatants while keeping players and NPCs ready for the next encounter.
- Clear the entire encounter to start with an empty combat tracker.
- View race, class, and level information for linked campaign players.

### Players / NPCs

Campaign records have an editable Player or NPC type. Prepared encounters can import editable copies of campaign Players and NPCs. Changes to those copies do not modify the roster. Single-use Players and NPCs remain available in Combat and prepared encounters.

New Players and NPCs start as drafts. Save creates the roster record with all entered fields; cancelling leaves no placeholder behind. Narrow roster rows show race/class/level beneath the name while wider screens retain the full columns.

- Save reusable Player and NPC records per campaign, with green Player and blue NPC type tags.
- Record name, race, class, level, optional HP, optional AC, and notes.
- Open and edit players directly from the searchable list.
- Delete individual players.
- Add saved players to an encounter without entering their information again.

Player and NPC management is available from the dedicated **Players / NPCs** navigation entry.

If HP or AC is not set, the combat tracker uses `10` when that player is added to an encounter.

### Bestiary

- Create monsters manually and assign a name.
- Record type, challenge rating, AC, HP, speed, ability scores, actions and traits, spellcasting details, and spell slots.
- Open a monster's full stat block and edit every field.
- Open and edit monsters directly from the searchable list.
- Delete individual monsters.
- Open the import window to connect automatically to the remote catalogue, search by name or source, preview and select multiple monsters for import.
- Open a local 5etools-compatible JSON catalogue (up to 10 MiB and 10,000 entries).
- Search the loaded catalogue by name or source and compare source, CR, type, HP, and AC before importing. Files are read in the browser; only selected records are sent to this server.
- Search the campaign Bestiary with typeahead filtering across monster names, types, CR, sources, abilities, spells, and notes.
- Select and import multiple monsters in one operation.
- Detect an existing monster with the same name and source, then choose whether to replace it or discard that individual import.
- Convert imported records to the DM Command Table format and save a campaign-local copy.

Imported monster data belongs to the current campaign and remains editable after import.

### Campaign planning

- Create dated session preparation and recap notes.
- Assign **Planned**, **Active now**, or **Happened** status to Sessions and Story beats.
- Search Session and Story content with typeahead filtering.
- Search campaign records with result-type filters for Sessions, Stories, Players, NPCs, and Bestiary monsters. Highlight matches and open the exact result directly.
- Lists always use compact spacing while retaining accessible touch targets. The sidebar shows your username beside Sign out; its version link opens the GitHub repository. Use the icon in the header to collapse or expand the desktop menu.
- Start with compact collapsed Sessions and Story beats, expand individual entries as needed, or expand and collapse every entry at once.
- Prepare multiple named encounters inside each session. New encounters expand immediately so you can add combatants.
- Encounters are numbered from 1 within each session, in display order. Deleting or reordering renumbers the list. Collapse encounters and drag their grip handles to reorder them; up/down buttons provide a keyboard and touch alternative. The order saves automatically, preserving other unsaved encounter edits. Concurrent changes reject the reorder instead of partially applying it.
- Save, Delete and Load encounter are available in each encounter header even when collapsed. Loading still opens the existing preview/confirmation; empty encounters cannot be loaded from this control.
- Open Session play view to use notes, linked story details, prepared encounters and searchable Player/NPC references together. Roster HP is a campaign reference; use Combat for live HP.
- Switch between Notes, Encounters, and Linked stories tabs without losing drafts. Save session & encounters saves the whole preparation workspace, including hidden tabs.
- Review collapsed encounters with colour-coded type counts, monster quantities, a combatant preview, and a notes excerpt.
- Add one or more instances of Bestiary monsters to every prepared encounter.
- Assign automatic or custom monster numbers such as **Goblin #1** and **Goblin #2**.
- Prepared encounters start collapsed; expand/collapse each separately or all encounters in a session at once.
- Add NPCs and custom combatants without the Bestiary, then edit names, types, initiative, HP, maximum HP, AC, and rich-text stat blocks and notes.
- Use Edit details on a Bestiary entry to create encounter-specific copies without modifying the Bestiary. Custom details are saved and carried into Combat.
- Players are unique by name (case-insensitive, ignoring surrounding spaces); duplicate Monsters and NPCs are allowed.
- Review a load preview before confirming: all current combatants being replaced, incoming records and duplicate Player entries being merged and the 10,000-combatant limit. Cancel leaves Combat unchanged; refresh retrieves its latest revision.
- Load a prepared encounter into Combat by replacing the entire current roster and resetting to round 1.
- Review all sessions chronologically from the Campaign timeline and jump directly to an individual session entry.
- Organize story beats by chapter and status: **Planned**, **Active now**, or **Happened**.
- Link Sessions to Story beats from a compact dropdown, review linked Session dates and statuses, and open a linked Session by selecting its name.
- Paste or upload screenshots into every rich-text notes field, including Campaign, Session, Story, Player, and Monster records.
- Format rich text with lists, bold, italic, underline, and text colors.
- Reuse uploaded screenshots from the local library; images scale automatically to the available browser width.

### Live combat tracking

Each combatant has independent temporary HP, concentration, death-save successes/failures and resource counters. **Damage** consumes temporary HP first; **Heal** respects maximum HP and clears death-save counters when HP becomes positive. **Undo HP change** restores both HP and the affected runtime state. Direct HP inputs are manual overrides. Temporary HP is set explicitly and does not stack automatically. Concentration damage prompts display a check DC; roll and clear concentration manually. Death-save counters do not automatically roll, stabilize or kill a creature.

Bestiary creatures capture a stat-block snapshot when added or loaded into Combat. Later Bestiary edits or deletion do not alter that snapshot. Spell-slot counters start from the captured slot totals. **Add legendary actions** creates three uses, configurable afterward, recovering at the start of that creature’s next turn. Add other counters for legendary resistance, abilities or limited-use items; choose manual recovery or own-turn recovery and use/restore individual counters. Duplicate creatures spend resources independently. Round reset does not restore resources. Rest recovery remains manual.

Conditions can tick at the start or end of the affected creature’s own turn, or remain until dismissed. A timed condition expires at its selected boundary unless **Requires save** is enabled; then it flags a saving throw and remains until you resolve it. Choose **Save succeeded: clear** or **Save failed: keep**. A failed persistent save can be prompted again at the next selected boundary. Blank durations remain active. Use **Mark save due** to request an earlier or manual save, and expand **Override timing or duration** for manual adjustments. Skipped creatures do not receive a start-of-turn tick; leaving the active creature’s turn resolves its end-of-turn effects.

Save, turn commands, combat undo, browser draft recovery and campaign exports retain runtime state. Prepared definitions retain fresh creation values; loading replaces the entire combat roster with fresh incoming copies. The fresh schema includes all runtime and condition fields from initialization.

### Draft recovery and turn preferences

Unsaved edits in Campaign, Players/NPCs, Bestiary, Stories, Sessions, prepared encounters and Combat are recoverable after refresh in the same browser. Choose Restore draft, Download draft or Discard draft before continuing edits. Drafts retain their original record revisions, so newer server changes require reconciliation. Browser drafts expire after seven days and are removed for the account on explicit sign-out. They are a recovery aid; Save still writes authoritative data to the local server. Browser storage failures display a warning.

Combat’s **At 0 HP** setting can skip everyone (the default), keep Player turns, or keep all turns. The preference is scoped to the account and campaign in this browser and is applied by the server to each turn/reset command. Death saves and other effects remain manually resolved.

## Storage architecture

DM Command Table uses a local-server model with no external database service:

1. Campaign and account actions use the self-hosted application. Opening Import monsters also contacts the fixed remote catalogue directly from the browser.
2. The application stores normalized campaign data in server-local SQLite.
3. SQLite runs in WAL mode with foreign-key checks and a five-second busy timeout.
4. The interface detects connectivity loss and never silently overwrites unsaved editor contents.
5. Uploaded screenshots are stored in an `uploads` directory beside the SQLite database.
6. JSON export provides portable campaign data, while server backups preserve uploaded screenshots.

The SQLite database contains local accounts, password hashes, login sessions, campaign ownership, normalized campaign records, and Viewer or Editor memberships. The default location is:

```text
./data/dm-command-table.sqlite
```

Set `DM_COMMAND_TABLE_DB_PATH` to use a different location. The directory is created automatically, and the fresh schema is initialized when the database is opened. Earlier database baselines are rejected without migrating their records.

By default, screenshots are written to an `uploads` directory beside the database. Set `DM_COMMAND_TABLE_UPLOAD_PATH` to override that location.

> A local monster catalogue is an import source, not a campaign database. Imported monsters are copied into the local campaign data.

## Authentication

DM Command Table provides its own server-local account system:

- Register the first administrator with a server-configured bootstrap token.
- Keep later registration disabled by default, or explicitly enable it while onboarding additional users.
- Passwords are salted and hashed with Node.js `scrypt`; plaintext passwords are never stored.
- Login sessions use random server-side tokens. Only a SHA-256 hash of each token is stored in SQLite.
- The browser receives an HttpOnly, `SameSite=Lax` session cookie that expires after 30 days by default (configurable in Administration).
- Signing out deletes the active server-side session.
- New accounts start without campaign records; create a campaign or import a campaign package to begin.
- Authentication, account administration, campaign writes and imports, password changes, and screenshot operations use SQLite-backed rate limits that survive application restarts.
- Campaign imports are schema-validated, size-limited, sanitized, and committed atomically.
- Screenshot storage has per-account and server-wide quotas with atomic allocation.
- Combat undo history and campaign audit events use configurable retention limits.

Accounts and sessions exist only in the configured SQLite database. No external identity provider or account database is contacted.

For a plain-HTTP private network deployment, keep:

```bash
DM_COMMAND_TABLE_SECURE_COOKIES=false
```

The default value, `auto`, marks cookies secure when a trusted proxy reports HTTPS through the first `X-Forwarded-Proto` value, or the browser sends an HTTPS Origin matching Host. This also supports HTTPS terminated before an internal HTTP proxy hop. You can set `DM_COMMAND_TABLE_SECURE_COOKIES=true` to require secure cookies unconditionally. Use `false` only for a trusted plain-HTTP private network.

Production startup requires `DM_COMMAND_TABLE_BOOTSTRAP_TOKEN` before the first account can be created. Generate a random value, enter it in the first-account registration form, and remove or rotate it after setup. The first account becomes administrator and automatically disables public registration. After the administrator exists, use **Administration** to enable or disable self-registration or create additional accounts directly.

Uploaded images are decoded and re-encoded as WebP before storage. Each account has a 100 MiB quota by default; change it with `DM_COMMAND_TABLE_SCREENSHOT_QUOTA_MB`. Users can access their own screenshots and screenshots referenced by campaigns they can access. Administrators retain access to the complete screenshot-management library.

The application sends a Content Security Policy, frame protection, MIME-sniffing protection, a restrictive permissions policy, and a referrer policy. Public deployments must use HTTPS; secure session cookies are enabled in auto mode for trusted forwarded HTTPS or a matching HTTPS browser Origin. Add HSTS at the HTTPS reverse proxy after confirming that the hostname is served exclusively over HTTPS.

## Visual monster stat blocks

Import results offer **View stat block** before selection. Opening a Bestiary monster shows the same local parchment-style block with AC, HP, speed, ability scores/modifiers, traits/actions and spellcasting. Core fields and rich text remain editable through the existing Bestiary controls. Combat displays the independently captured encounter snapshot, so later Bestiary edits do not change a live encounter's block. All views render locally and remain available offline.

New imports retain alignment, armor/HP formula details, saving throws, skills, damage/condition defenses, senses, passive Perception, languages and full spell lists in the existing ability/spell fields. Existing saved records render their available fields immediately; reimport with replacement adds catalogue details that older imports did not retain. Existing combat snapshots keep their captured values. Stat blocks render locally without embedding the catalogue webpage.

Monster token icons appear at the upper right of visual stat blocks. Available tokens are downloaded from the catalogue during import and saved to the existing local image library; Bestiary and captured Combat blocks display these images offline. Reimport older monsters with replacement enabled to add tokens. Missing/unavailable token images do not block monster import. Token previews use temporary browser images. Both Bestiary and Combat stat blocks start expanded; click **Visual stat block** to collapse or expand them.

To delete a Bestiary monster used by a prepared encounter, first remove that monster from every prepared encounter that uses it. The application explains this dependency without showing a save-conflict banner. Bulk deletion is atomic: if one selected monster cannot be deleted, the entire selection remains. Genuine stale revision saves still show the save-conflict warning.

The Bestiary editor has a separate **Token** section for the full monster image. Paste an image there, or edit/clear that field to replace or remove it, then save the monster. **Actions & traits** contains the rules text independently. Existing imported token images move into Token automatically when upgrading; no reimport is needed. Combat continues to display the icon from its captured snapshot.

## Storage limits

Administration displays database/WAL usage, free disk space and the host-configured campaign/record budgets. If a save or import reaches a budget, remove unused content or ask the host administrator to adjust the limit. Existing data remains available. New password hashes are applied automatically at account creation/reset and after a successful login with an older hash; no password reset is required for this upgrade.
