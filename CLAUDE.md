# CLAUDE.md

## Project overview

Retrospectrix — real-time retrospective board. SvelteKit (Svelte 5 runes) + Socket.IO + PostgreSQL (Drizzle ORM).

## Tech stack

- **Frontend**: SvelteKit, Svelte 5 ($state/$derived/$effect), Tailwind CSS 4
- **Backend**: Node.js, Socket.IO, Drizzle ORM
- **Database**: PostgreSQL 16
- **Build**: Vite 7, adapter-node
- **Tests**: Vitest
- **CI/CD**: GitHub Actions → SSH deploy

## Key directories

- `src/lib/components/` — Svelte components
- `src/lib/stores/` — Svelte stores (.svelte.ts files use $state runes)
- `src/lib/i18n/` — i18n: en.json, ru.json, t() function
- `src/lib/server/` — server-side code (DB, encryption, StatsD)
- `src/routes/` — SvelteKit routes
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

Secrets configured in GitHub: SSH_HOST, SSH_USER, SSH_KEY, SSH_PORT, PROJECT_PATH.

## Conventions

- i18n: all user-facing strings go through `t('key')` from `$lib/i18n/index.js`
- Theme: light/dark via CSS custom properties in `src/app.css`, toggle with `.dark` class
- Stores use Svelte 5 runes ($state, $derived) in `.svelte.ts` files
- Components import `{ t }` for translations
