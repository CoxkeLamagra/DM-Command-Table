# DM Command Table

DM Command Table is a private, browser-based workspace for running and preparing tabletop RPG campaigns. It keeps live encounter management, reusable creature details, session notes, and campaign story progress in one responsive interface.

The hosted application is available at [dm-command-table.lamalyon.chatgpt.site](https://dm-command-table.lamalyon.chatgpt.site). Access is restricted by the site's private access policy.

## Features

- Initiative tracker with rounds, turns, and quick turn advancement
- Red, green, and blue combatant types for Monsters, Players, and NPCs
- Editable combatant names, initiative, armor class, current HP, and maximum HP
- Standard or custom status conditions with removable condition chips
- Two-pane combat view with initiative on the left and selected details on the right
- Reusable bestiary with stat blocks, actions, abilities, spells, and spell slots
- Session preparation and recap notes
- Story beats with Planned, Active, and Happened states
- Multiple campaigns with automatic account synchronization
- IndexedDB offline cache for reliable device-local access
- Private campaigns and explicit Viewer or Editor sharing
- JSON export and import for portable backups
- Managed Sign in with ChatGPT authentication
- Responsive desktop and mobile layouts

## Technology

- React 19 and TypeScript
- Next.js 16 through Vinext/Vite
- Tailwind CSS 4 and shadcn-based UI components
- Cloudflare Workers and D1
- Drizzle ORM

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

The local development environment provides a simulated ChatGPT sign-in route at:

```text
/signin-with-chatgpt?return_to=/
```

## Database

Campaigns are cached in browser IndexedDB and synchronized to Cloudflare D1 when the user is signed in. The server stores campaign ownership and explicit Viewer or Editor memberships. Apply the included migrations to a local D1 database after the first build:

```bash
pnpm build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_misty_blindfold.sql
```

The API is exposed through `app/api/campaigns/route.ts`:

- `GET /api/campaigns` loads campaigns available to the signed-in user.
- `POST /api/campaigns` creates or shares a campaign.
- `PUT /api/campaigns` saves an owned or editable campaign.
- `DELETE /api/campaigns?id=...` deletes an owned campaign.

## Build

Create the production bundle with:

```bash
pnpm build
```

Preview the built Cloudflare Worker locally with:

```bash
pnpm start
```

## Project structure

```text
app/                  Application UI, layout, and state API
components/ui/        Reusable interface primitives
db/                   D1 connection and Drizzle schema
drizzle/              Database migration and metadata
public/               Favicon and static assets
scripts/              Cross-platform build and runtime helpers
.openai/hosting.json  ChatGPT Sites hosting configuration
```

## Data and privacy

- Authentication is provided by managed Sign in with ChatGPT.
- Campaigns are private by default and shared only with explicitly invited email addresses.
- Campaign data is stored centrally in D1 and cached locally in IndexedDB.
- Viewers cannot save campaign changes; Editors can collaborate; Owners can share or delete.
- `.env` files, local database state, build output, and execution-profile files are excluded from version control.

## Current scope

The authentication boundary is isolated behind `app/chatgpt-auth.ts` so it can be replaced by a self-hosted username/password provider later. Potential additions include reusable encounters, editable spell-slot expenditure, creature imports, richer condition controls, and revision history.

## License

No open-source license has been assigned. All rights are reserved unless the repository owner adds a license.
