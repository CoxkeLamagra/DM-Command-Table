# DM Command Table

DM Command Table is a browser-based workspace for preparing and running tabletop RPG campaigns. It combines campaign management, reusable player and monster records, live encounter tracking, session notes, and story planning in one responsive interface.

On desktop, the left menu can collapse to icons only using **Collapse menu**, then reopen using **Expand menu**. Icons retain hover labels, and the browser remembers your preference. Mobile navigation opens with full labels.

This is a hobby project to see how far vibe coding can take me without writing a single piece of code by hand. Please keep this in mind when using this project.

The current release is **v9.3.0**, using the **v9 architecture**. Existing v9 installations retain their data. The v9 baseline does not upgrade pre-v9 database formats; deploy those installations with a separate fresh data directory and keep their verified backups.

Debian 13 LXC is the primary deployment option; Docker is secondary. Both run the same packaged standalone Node server. See [LXC installation and recovery](docs/debian-13-lxc.md) and [architecture](docs/architecture.md), [Docker deployment](docs/docker.md), and [operations](docs/operations.md).

Campaign data, accounts, screenshots, search, and backups remain on your server. Bestiary JSON files import offline. Connecting to the external monster catalogue is an explicit optional action. Next.js telemetry is disabled in the deployment templates.

## Features

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

### Local user administration

- The first locally registered account automatically becomes an administrator.
- Administrators can open **Administration** to review all registered accounts.
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
- Apply damage or healing by amount, with an immediate Undo HP change control.
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
- Import monsters from the 5etools-compatible JSON catalogue hosted at [dnd5e.lamagra.link](https://dnd5e.lamagra.link/bestiary.html).
- Search the remote catalogue with typeahead results and compare source, CR, type, HP, and AC before importing.
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
- Choose comfortable or compact list spacing from the sidebar; the preference is remembered in this browser.
- Start with compact collapsed Sessions and Story beats, expand individual entries as needed, or expand and collapse every entry at once.
- Prepare multiple named encounters inside each session.
- Open Session play view to use notes, linked story details, prepared encounters and searchable Player/NPC references together. Roster HP is a campaign reference; use Combat for live HP.
- Switch between Notes, Encounters, and Linked stories tabs without losing drafts. Save session & encounters saves the whole preparation workspace, including hidden tabs.
- Review collapsed encounters with colour-coded type counts, monster quantities, a combatant preview, and a notes excerpt.
- Add one or more instances of Bestiary monsters to every prepared encounter.
- Assign automatic or custom monster numbers such as **Goblin #1** and **Goblin #2**.
- Prepared encounters start collapsed; expand/collapse each separately or all encounters in a session at once.
- Add NPCs and custom combatants without the Bestiary, then edit names, types, initiative, HP, maximum HP, AC, and rich-text stat blocks and notes.
- Use Edit details on a Bestiary entry to create encounter-specific copies without modifying the Bestiary. Custom details are saved and carried into Combat.
- Review a load preview before confirming: retained Players/NPCs, replaced monsters, incoming records, possible duplicate names and the 10,000-combatant limit. Cancel leaves Combat unchanged; refresh retrieves its latest revision.
- Load a prepared encounter into Combat while preserving existing players and NPCs, replacing current monsters, and resetting to round 1.
- Review all sessions chronologically from the Campaign timeline and jump directly to an individual session entry.
- Organize story beats by chapter and status: **Planned**, **Active now**, or **Happened**.
- Link Sessions to Story beats from a compact dropdown, review linked Session dates and statuses, and open a linked Session by selecting its name.
- Paste or upload screenshots into every rich-text notes field, including Campaign, Session, Story, Player, and Monster records.
- Format rich text with lists, bold, italic, underline, and text colors.
- Reuse uploaded screenshots from the local library; images scale automatically to the available browser width.

### Draft recovery and turn preferences

Unsaved edits in Campaign, Players/NPCs, Bestiary, Stories, Sessions, prepared encounters and Combat are recoverable after refresh in the same browser. Choose Restore draft, Download draft or Discard draft before continuing edits. Drafts retain their original record revisions, so newer server changes require reconciliation. Browser drafts expire after seven days and are removed for the account on explicit sign-out. They are a recovery aid; Save still writes authoritative data to the local server. Browser storage failures display a warning.

Combat’s **At 0 HP** setting can skip everyone (the default), keep Player turns, or keep all turns. The preference is scoped to the account and campaign in this browser and is applied by the server to each turn/reset command. Death saves and other effects remain manually resolved.

## Storage architecture

DM Command Table uses a local-server model with no external database service:

1. The browser communicates only with the self-hosted Node.js application.
2. The application stores normalized campaign data in server-local SQLite.
3. SQLite runs in WAL mode with foreign-key checks and a five-second busy timeout.
4. The interface detects connectivity loss and never silently overwrites unsaved editor contents.
5. Uploaded screenshots are stored in an `uploads` directory beside the SQLite database.
6. JSON export provides portable campaign data, while server backups preserve uploaded screenshots.

The SQLite database contains local accounts, password hashes, login sessions, campaign ownership, normalized campaign records, and Viewer or Editor memberships. The default location is:

```text
./data/dm-command-table.sqlite
```

Set `DM_COMMAND_TABLE_DB_PATH` to use a different location. The directory is created automatically, and migrations run when the database is opened.

By default, screenshots are written to an `uploads` directory beside the database. Set `DM_COMMAND_TABLE_UPLOAD_PATH` to override that location.

> The remote monster catalogue is an import source, not a campaign database. Imported monsters are copied into the local campaign data.

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

The default value, `auto`, marks cookies secure when `DM_COMMAND_TABLE_TRUST_PROXY=true` and the reverse proxy reports HTTPS through `X-Forwarded-Proto`. You can set `DM_COMMAND_TABLE_SECURE_COOKIES=true` to require secure cookies unconditionally. Use `false` only for a trusted plain-HTTP private network.

Production startup requires `DM_COMMAND_TABLE_BOOTSTRAP_TOKEN` before the first account can be created. Generate a random value, enter it in the first-account registration form, and remove or rotate it after setup. `DM_COMMAND_TABLE_REGISTRATION_MODE` defines the initial registration state and defaults to `first-user`, which prevents later public registration. After the administrator exists, use **Administration** to enable or disable self-registration or create additional accounts directly.

Uploaded images are decoded and re-encoded as WebP before storage. Each account has a 100 MiB quota by default; change it with `DM_COMMAND_TABLE_SCREENSHOT_QUOTA_MB`. Users can access their own screenshots and screenshots referenced by campaigns they can access. Administrators retain access to the complete screenshot-management library.

The application sends a Content Security Policy, frame protection, MIME-sniffing protection, a restrictive permissions policy, and a referrer policy. Public deployments must use HTTPS; secure session cookies are enabled in auto mode when proxy trust is enabled and the reverse proxy reports HTTPS. Add HSTS at the HTTPS reverse proxy after confirming that the hostname is served exclusively over HTTPS.

## Technology

- React 19 and TypeScript
- Next.js 16 on Node.js
- Tailwind CSS 4 with shadcn-based UI components
- Node's built-in SQLite driver
- SQLite FTS5 for local campaign search

## Requirements

- Node.js 22.13 or newer
- pnpm 11.25.0, pinned in `package.json`
- A writable directory for the SQLite database

## Local development

Install the locked dependencies:

```bash
pnpm install --frozen-lockfile
```

Optionally copy the environment example:

```bash
cp .env.example .env.local
```

Start the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The database and tables are created automatically on the first API request.

## Production build

Create the production build:

```bash
pnpm build
```

Export the production environment in your shell before starting the server. `pnpm start` runs the standalone artifact; it does not load `.env.local` for operational scripts. Use absolute storage paths to keep application and backup commands pointed at the same data.

Start the Node.js server:

```bash
pnpm start
```

The server listens on port `3000` by default. Make sure the process can write to the directories configured by `DM_COMMAND_TABLE_DB_PATH` and `DM_COMMAND_TABLE_UPLOAD_PATH`.

## Debian 13 LXC deployment

For a complete bare-metal-style LXC installation with Node.js 24 LTS, systemd, Nginx, persistent SQLite storage, backups, and a one-command GitHub update workflow, see:

- [Deploy DM Command Table in a Debian 13 LXC](docs/debian-13-lxc.md)

Reusable configuration templates are available under `deploy/debian-13/`.

## Docker deployment

Docker is the secondary deployment target. See [Docker installation, updates and recovery](docs/docker.md) for the pinned release checkout, private bootstrap token, persistent volume, proxy configuration and backup commands. Compose binds port 3000 to loopback by default; the database and screenshots live in its named `/data` volume.

## Server data backup

Create a consistent, timestamped SQLite snapshot together with its referenced screenshot files:

```bash
pnpm backup
```

Operational scripts read exported environment variables, not Next.js `.env.local`. See [operations](docs/operations.md) for the configuration reference and environment-loading commands.

The destination defaults to `./data/backups` and can be changed with `DM_COMMAND_TABLE_BACKUP_PATH`. The command holds a SQLite write reservation while capturing the committed database and copying only its recorded screenshots. Saves can briefly wait during large backups. SHA-256 checksums, database integrity and foreign-key checks verify the backup before completion. Backup directories and files receive restrictive permissions. For Docker Compose:

```bash
docker compose exec dm-command-table node scripts/backup-local.mjs
```

Validate SQLite integrity and ensure every screenshot database row has a matching local file (and vice versa):

```bash
pnpm check:storage
```

Verify a completed backup, or restore it into a new empty directory:

```bash
node scripts/restore-local.mjs /path/to/backup
node scripts/restore-local.mjs /path/to/backup /path/to/new-restored-data
```

The restore command refuses existing destinations. Stop the application before switching its database and uploads paths to the restored files. A JSON campaign export contains screenshot references but does not include binary image files; retain a full server backup as well.

## Development verification

```bash
pnpm verify
pnpm exec playwright install chromium
pnpm test:browser
```

Browser tests use a temporary local database and disposable test account, without touching application data. The test server runs on port 3100; build first with `pnpm build`. CI runs verification and browser regression tests on Node.js 22 and 24.

Session Save writes the session and its prepared encounter edits in one transaction. Encounter drafts remain available when their Session is collapsed or filtered out. Leaving Sessions with unsaved changes asks for confirmation. Ability scores, actions and spell details remain in the existing rich-text stat block field.

## Architecture and API

See [architecture](docs/architecture.md) for the source layers, local storage model, revision handling and runtime packaging, and [API reference](docs/api.md) for the authenticated endpoints. [Release assessment](docs/release-assessment.md) records the cleanup decisions and validation limits for v9.1.0.

## Data and privacy

- Campaign data is stored in the self-hosted application's server-local SQLite file.
- No external database service is used by this version.
- Passwords and sessions are stored only in the server-local SQLite database.
- Screenshot files remain in the configured server-local uploads directory and are only listed or served to their uploader, an administrator, or a user who can access a campaign that references them.
- Campaigns are private unless the owner explicitly grants access to another registered username.
- Exported JSON files contain the complete campaign payload, including players, monsters, prepared encounters, active combat, notes, and story data.
- Imported monster records are copied into the campaign; the application does not depend on the remote source after import.
- SQLite files, environment files, dependencies, and build output are excluded from version control.

## Current limitations

- Collaboration does not provide presence indicators or live cursor sharing; revision checks prevent silent stale writes.
- SQLite is intended for one application instance with persistent local storage. Multiple application instances must not write independent copies of the database.
- Campaign sharing uses registered local usernames and owner-managed Editor/Viewer memberships.
- Optional remote catalogue imports depend on that source; local JSON imports work offline.
- Plain campaign JSON exports contain image references. Use **Export with images** for campaign portability, and verified server backups for complete disaster recovery.

## Release history

See [CHANGELOG.md](CHANGELOG.md). The version shown in the lower-left corner of the application links to the GitHub repository.

## License

No open-source license has been assigned. All rights are reserved unless the repository owner adds a license.
