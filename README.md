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
- Automatic saving to persistent campaign storage
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

Campaign state is stored in the `campaign_states` D1 table. Apply the included migration to a local D1 database after the first build:

```bash
pnpm build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_misty_blindfold.sql
```

The API is exposed through `app/api/state/route.ts`:

- `GET /api/state` loads the saved campaign state.
- `PUT /api/state` validates and saves the complete campaign state.

The current implementation uses one persistent campaign record identified as `main-campaign`.

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

- The hosted site is private and requires authorized access.
- Campaign data is stored in the hosted D1 database, not in browser local storage.
- `.env` files, local database state, build output, and execution-profile files are excluded from version control.

## Current scope

This is the first functional release. It currently maintains one campaign workspace. Potential future additions include multiple campaigns, reusable encounters, editable spell-slot expenditure, creature imports, and richer condition controls.

## License

No open-source license has been assigned. All rights are reserved unless the repository owner adds a license.
