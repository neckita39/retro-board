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

- `src/lib/components/` — Svelte components (Card, CardForm, CommentForm, Lightbox, ToggleSwitch, Summary/SummaryRow/FocusTimer, Seo, JsonLd, etc.)
- `src/lib/stores/` — Svelte stores (.svelte.ts files use $state runes)
- `src/lib/i18n/` — i18n: en.json, ru.json, t() function
- `src/lib/content/` — long-form page content as inline `{ en, ru }` pairs (formats.ts, guide.ts) plus the `txt()` helper; dictionaries stay for UI chrome
- `src/lib/server/` — server-side code (DB, encryption, image processing, StatsD)
- `src/routes/` — SvelteKit routes
- `src/routes/api/` — REST endpoints (upload, image serving, feedback)
- `drizzle/` — DB migrations
- `static/` — static assets (logo.png, favicon)

## Commands

- `npm test` — run unit tests (Vitest, no DB/Docker needed)
- `npm run test:watch` — run tests in watch mode
- `npm run test:e2e` — Playwright e2e smoke suite (needs `docker compose up -d db` first; builds the app and runs it on port 4777)
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

Unit tests are in `src/**/*.test.ts`. Run with `npm test`. They are pure unit tests — no DB, Docker, or browser required.

E2e smoke tests are in `e2e/*.spec.ts` (Playwright, chromium, 1 worker). They run the built app via `node server.js` on port 4777 against a real PostgreSQL (local: compose `db` on host port 5433; CI: postgres service container). Shared helpers in `e2e/helpers.ts` (`createBoard`, `addCard`, `column`, `initStorage`) — every test creates its own board, no DB cleanup needed. In CI the `e2e` job gates the deploy.

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
- **Focus mode**: creator presses "Обсудить" in Summary — the discussed card is highlighted on every participant's screen, others dim, page auto-scrolls, own 5-minute timer per card, visited cards get a checkmark. Room state in memory (`roomFocus` in server.js), navigation logic in `src/lib/focus.ts`
- **Export**: JSON and Markdown
- **Changelog**: `/changelog` — user-facing changelog with timeline UI
- **Feedback**: `/feedback` — form that sends notifications to Telegram bot
- **Visit analytics**: `retro.guest.from_web` (one per visit, session cookie `retro_visit`) plus `retro.guest.source.{google|yandex|search_other|social|direct|other}` by referrer; bots filtered. Pure logic in `src/lib/server/visitors.ts`, wired in `src/hooks.server.ts`
- **Content pages**: `/formats` + `/formats/[format]` (Start Stop Continue, Mad Sad Glad, 4L, Sailboat) and `/how-to-run-a-retro` — the SEO landing pages. Content lives in `src/lib/content/`, unknown format slugs 404 via `+page.server.ts`
- **Board formats**: `board-formats.js` **in the repo root** is the registry of column presets (classic, start-stop-continue, mad-sad-glad, 4l, sailboat); `server.js`, `src/lib/formats.ts` and the export read it, so it is in the Dockerfile COPY line like `seo-paths.js`. `boards.format` is set at creation and never changes; `cards.column_type` is plain text validated against the board's format. Old boards are `classic` with the original `went_well / didnt_go_well / improve` ids. Format id = `/formats/<slug>` slug, so `/new?format=<slug>` preselects it; the browser remembers `retro_format`, a space remembers `last_format`
- **SEO**: `seo-paths.js` **in the repo root** is the single source of truth for what may be indexed — `server.js`, `sitemap.xml` and the robots test all read it. It sits in the root because `server.js` runs in production next to `build/` and `src/` is not copied into the runtime image (see Dockerfile); add it to the Dockerfile COPY line if you split it up. Everything not in `INDEXABLE_PATHS` gets `X-Robots-Tag: noindex, nofollow` — boards `/{slug}` and spaces `/spaces/*` are protected by an unguessable link only and must never be listed. `src/lib/seo.test.ts` asserts robots.txt and the path list have not drifted. Verification files for Google/Yandex live in `static/`
- **Meta tags**: every public page uses `<Seo>` (title/description/canonical/og/twitter) and `<JsonLd>` for schema.org. Note: a literal `<` followed by `script` anywhere in a Svelte file — markup *or* comment — terminates the component's script block; `JsonLd.svelte` builds the tag from concatenated pieces for exactly this reason
- **Fonts**: Unbounded and Golos Text are self-hosted from `static/fonts/`, declared in `src/fonts.css`. That import must stay **above** `@import 'tailwindcss'` in `app.css` — an `@import` after it is dropped from the bundle
- **i18n**: English and Russian (locale store defaults to `ru` — that is the version search engines see)
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
