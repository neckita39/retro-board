# CLAUDE.md

## Project overview

Retrospectrix — real-time retrospective board. SvelteKit (Svelte 5 runes) + Socket.IO + PostgreSQL (Drizzle ORM).

## Tech stack

- **Frontend**: SvelteKit, Svelte 5 ($state/$derived/$effect), Tailwind CSS 4
- **Backend**: Node.js, Socket.IO, Drizzle ORM
- **Database**: PostgreSQL 16
- **Image processing**: Sharp (compress → WebP, max 1200px)
- **Build**: Vite 7, adapter-node
- **Tests**: Vitest
- **CI/CD**: GitHub Actions → SSH deploy (DOCKER_BUILDKIT=0)

## Key directories

- `src/lib/components/` — Svelte components (Card, CardForm, CommentForm, Lightbox, ToggleSwitch, etc.)
- `src/lib/stores/` — Svelte stores (.svelte.ts files use $state runes)
- `src/lib/i18n/` — i18n: en.json, ru.json, t() function
- `src/lib/server/` — server-side code (DB, encryption, image processing, StatsD)
- `src/routes/` — SvelteKit routes
- `src/routes/api/` — REST endpoints (upload, image serving, feedback)
- `drizzle/` — DB migrations
- `static/` — static assets (logo.png, favicon)

## Commands

- `npm test` — run unit tests (Vitest, no DB/Docker needed)
- `npm run test:watch` — run tests in watch mode
- `npm run dev` — dev server (needs DB running)
- `npm run build` — production build
- `npm run check` — svelte-check type checking
- `docker compose up -d --build` — local dev with Docker
- `docker compose -f docker-compose.prod.yml up -d --build` — production deploy

## Local development

Run locally via Docker:
```sh
docker compose up -d --build
```
App available at http://localhost:3777

## Testing

Tests are in `src/**/*.test.ts`. Run with `npm test`. Tests are pure unit tests — no DB, Docker, or browser required.

When adding new i18n keys, add to BOTH en.json and ru.json — the dictionary integrity test will catch missing keys.

## CI/CD Pipeline

GitHub Actions workflow (`.github/workflows/ci.yml`):
1. On push/PR to main: `npm ci` → `npm test` → `npm run build`
2. On push to main only: SSH deploy to production server
3. Uses `DOCKER_BUILDKIT=0` to avoid stale build context cache
4. Auto-prunes old Docker images and build cache after deploy
5. `set -e` — stops on error (won't deploy stale code)

Secrets configured in GitHub: SSH_HOST, SSH_USER, SSH_KEY, SSH_PORT, PROJECT_PATH.

## Features

- **Boards**: real-time retro boards with 3 columns, cards, voting, comments
- **Spaces**: group boards together, optional password protection
- **Image attachments**: attach images to cards/comments, auto-compressed via Sharp, stored in PostgreSQL bytea, lightbox viewer
- **Timer**: discussion timer with visual countdown
- **Export**: JSON and Markdown
- **Changelog**: `/changelog` — user-facing changelog with timeline UI
- **Feedback**: `/feedback` — form that sends notifications to Telegram bot
- **i18n**: English and Russian
- **Dark mode**: CSS custom properties, smooth transitions

## Image upload flow

1. Client selects image → local preview shown
2. `POST /api/upload` — server validates magic bytes, compresses with Sharp (WebP 80%), stores in `images` table (bytea)
3. Response: `{ imageId, width, height }`
4. Client sends `card:create` / `comment:create` via Socket.IO with `imageId`
5. Image served via `/api/image/{id}` with immutable cache headers
6. Image serving handled in `server.js` (raw HTTP, bypasses SvelteKit)
7. Upload goes through SvelteKit route (BODY_SIZE_LIMIT=20MB env var)

## Conventions

- i18n: all user-facing strings go through `t('key')` from `$lib/i18n/index.js`
- Theme: light/dark via CSS custom properties in `src/app.css`, toggle with `.dark` class
- Stores use Svelte 5 runes ($state, $derived) in `.svelte.ts` files
- Components import `{ t }` for translations
- Changelog entries: write for end users, no technical jargon
- Animations: CSS keyframes in app.css, spring easing `cubic-bezier(0.34,1.56,0.64,1)`, collapsible panels via `grid-template-rows`
- Security headers set in server.js (X-Content-Type-Options, X-Frame-Options, HSTS, etc.)

## Environment variables (production)

See `.env.example` for full list. Key ones:
- `DATABASE_URL` — PostgreSQL connection string
- `ENCRYPTION_KEY` — AES-256-GCM key for card/comment encryption
- `BODY_SIZE_LIMIT` — max upload size (default 20MB)
- `APP_PORT` — external port mapping (default 80)
- `TG_BOT_TOKEN` — Telegram bot token for feedback notifications
- `TG_CHAT_ID` — Telegram chat ID to receive feedback
