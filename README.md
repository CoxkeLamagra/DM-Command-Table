# DM Command Table

DM Command Table is a browser-based workspace for preparing and running tabletop RPG campaigns. It combines campaign management, reusable player and monster records, live encounter tracking, session notes, and story planning in one responsive interface.

The current stable release is **v1.0.0**. The hosted application is available at [dm-command-table.lamalyon.chatgpt.site](https://dm-command-table.lamalyon.chatgpt.site); access is governed by the site's configured access policy.

## Features

### Campaigns and sharing

- Create, switch between, and delete multiple campaigns.
- Store a device-local copy of every campaign in IndexedDB for offline access.
- Synchronize campaign progress to the server when signed in.
- Export and import complete campaigns as portable JSON files.
- Share campaigns with another DM Command Table user by email.
- Assign **Editor** access for collaboration or **Viewer** access for read-only use.
- Poll for server changes every five seconds while the application is open.

Campaigns are private by default. Only the owner can share or delete a campaign. Owners and editors can save changes; viewers cannot modify campaign data.

### Combat tracker

- Give each encounter its own editable name.
- Add ad-hoc players, monsters, or NPCs.
- Add reusable players from the campaign roster.
- Add monsters from the campaign bestiary with their linked stat blocks.
- Track initiative, turn order, rounds, armor class, current and maximum HP, and conditions.
- Highlight combatants at `0 HP` as downed and automatically skip them when advancing to the next turn.
- Reset the round counter without removing combatants.
- Clear the entire encounter to start with an empty combat tracker.
- View race, class, and level information for linked campaign players.

### Campaign player roster

- Save reusable player records per campaign.
- Record name, race, class, level, optional HP, optional AC, and notes.
- Use card or compact list views.
- Delete individual players or select several players for bulk deletion.
- Add saved players to an encounter without entering their information again.

If HP or AC is not set, the combat tracker uses `10` when that player is added to an encounter.

### Bestiary

- Create monsters manually and assign a name.
- Record type, challenge rating, AC, HP, speed, ability scores, actions and traits, spellcasting details, and spell slots.
- Open a monster's full stat block and edit every field.
- Use card or compact list views.
- Delete individual monsters or select several monsters for bulk deletion.
- Import monsters from the 5etools-compatible JSON catalogue hosted at [dnd5e.lamagra.link](https://dnd5e.lamagra.link/bestiary.html).
- Search the remote catalogue and compare source, CR, type, HP, and AC before importing.
- Convert imported records to the DM Command Table format and save a campaign-local copy.

Imported monster data belongs to the current campaign and remains editable after import.

### Campaign planning

- Create dated session preparation and recap notes.
- Mark session notes as completed.
- Organize story beats by chapter and status: **Planned**, **Active now**, or **Happened**.

## Storage and synchronization

DM Command Table uses a local-first storage model:

1. Campaigns are cached in browser IndexedDB.
2. When authenticated and online, campaign data is synchronized through `/api/campaigns` to Cloudflare D1.
3. If the server is unavailable, the cached campaign remains usable and changes continue to be saved on the device.
4. JSON export provides a portable backup and a file-based sharing option.

The server stores campaign ownership, campaign payloads, and explicit Viewer or Editor memberships. Live collaboration uses periodic synchronization rather than simultaneous field-level editing; if multiple editors change the same campaign, the most recently saved campaign payload becomes the server version.

## Authentication

The hosted application currently uses managed **Sign in with ChatGPT**. The authentication boundary is isolated in `app/chatgpt-auth.ts` so it can be replaced with a different account system in a future release.

Local development uses the hosting environment's simulated authentication route:

```text
/signin-with-chatgpt?return_to=/
```

## Technology

- React 19 and TypeScript
- Next.js 16 through Vinext and Vite
- Tailwind CSS 4 with shadcn-based UI components
- Cloudflare Workers and D1
- Drizzle ORM
- Browser IndexedDB for the local campaign cache

## Requirements

- Node.js 22.13 or newer
- pnpm 11.25 or newer

## Local development

Install the locked dependencies:

```bash
pnpm install --frozen-lockfile
```

Start the development server:

```bash
pnpm dev
```

Open the local URL shown in the terminal. The UI is responsive and can be used on desktop and mobile browsers.

## Local database setup

The application expects a D1 binding named `DB`. Build the project, then apply both migrations to the local D1 database:

```bash
pnpm build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_misty_blindfold.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_volatile_patriot.sql
```

The campaign API is implemented in `app/api/campaigns/route.ts`:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/campaigns` | Load campaigns available to the signed-in user. |
| `POST` | `/api/campaigns` | Create a campaign or grant campaign access. |
| `PUT` | `/api/campaigns` | Save a campaign when the user is its owner or an editor. |
| `DELETE` | `/api/campaigns?id=...` | Delete a campaign owned by the signed-in user. |

## Build and run locally

Create the production bundle:

```bash
pnpm build
```

Run the built Cloudflare Worker locally:

```bash
pnpm start
```

The start command uses Wrangler with local state stored under `.wrangler/state`.

## Web deployment

The production build targets Cloudflare Workers and requires:

- A D1 database bound as `DB`.
- Both SQL migrations from `drizzle/` applied to the production database.
- Authentication headers compatible with `app/chatgpt-auth.ts`, or a replacement authentication adapter.
- Network access to `https://dnd5e.lamagra.link` for remote monster catalogue imports.

The included `.openai/hosting.json` configures deployment through ChatGPT Sites. The project can also be deployed to another compatible Cloudflare Workers environment after configuring the same database binding and authentication behavior.

## Project structure

```text
app/                  Application UI, authentication adapter, and campaign API
components/ui/        Reusable interface primitives
db/                   D1 connection and Drizzle schema
drizzle/              Database migrations and metadata
lib/                   IndexedDB campaign cache and shared utilities
public/                Favicons and static assets
scripts/               Cross-platform build and runtime helpers
.openai/hosting.json  ChatGPT Sites hosting configuration
```

## Data and privacy

- Campaign data is stored locally in IndexedDB and centrally in D1 when synchronization is available.
- Campaigns are private unless the owner explicitly grants access to another email address.
- Pending invitations become active when the invited user signs in with the matching email address.
- Exported JSON files contain the complete campaign payload, including players, monsters, encounters, notes, and story data. Treat exported files as private campaign data.
- Imported monster records are copied into the campaign; the application does not depend on the remote source after import.
- `.env` files, local database state, build output, and execution-profile files are excluded from version control.

## Current limitations

- Authentication is currently tied to managed Sign in with ChatGPT; native username/password accounts are not included in v1.0.
- Collaboration synchronizes complete campaign snapshots and does not provide presence indicators, record locking, or conflict merging.
- A campaign invite is managed by granting access again with the desired role; the current interface does not include a membership-management screen.
- Monster importing depends on the external catalogue being reachable and retaining its compatible JSON structure.

## Release

- Latest stable release: [DM Command Table 1.0](https://github.com/CoxkeLamagra/DM-Command-Table/releases/tag/v1.0.0)
- Release tag: `v1.0.0`

## License

No open-source license has been assigned. All rights are reserved unless the repository owner adds a license.
