# Retrospectrix Design System

Source of truth for UI consistency across all pages.

## Colors

Warm "paper" palette. Green/red/blue are reserved for column semantics;
terracotta is the only action accent.

### Light Mode
| Token | Hex | Usage |
|-------|-----|-------|
| `surface` | `#F7F6F2` | Page background |
| `surface-card` | `#FFFFFF` | Cards, panels, header |
| `surface-hover` | `#ECEBE5` | Hover backgrounds, neutral fills |
| `text-primary` | `#211E1A` | Ink — headings, body text, dark buttons |
| `text-secondary` | `#6B6A61` | Descriptions, meta |
| `text-muted` | `#96958A` | Placeholders, disabled |
| `border` | `#E5E4DC` | Borders, dividers |
| `border-strong` | `#D9D8CF` | Emphasized borders, breadcrumb separators |
| `accent` | `#C4552B` | Terracotta — CTA, links, timer, active nav |
| `accent-hover` | `#A94620` | Accent hover state |
| `accent-bg` | `#F7E7DE` | Accent tint — badges, "live now", plus circle |
| `well` | `#4C8C6A` | Green column: underline, count, mood bar |
| `well-bg` | `#EDF4EF` | Green tint — active like pill background |
| `well-strong` | `#3A7355` | Text on green tint |
| `bad` | `#C05B4D` | Red column + destructive actions |
| `bad-bg` | `#F5E9E5` | Red tint |
| `bad-strong` | `#8A3D30` | Text on red tint |
| `improve` | `#5B72C0` | Blue column |
| `improve-bg` | `#E9EDF6` | Blue tint |
| `improve-strong` | `#3A4C87` | Text on blue tint |

### Dark Mode
Overrides in `.dark` class, derived from the same warm palette:
- Surfaces are warm dark browns (`#191713`, `#211E1A`, `#2B2721`)
- `accent` becomes `#D97A50` (lighter terracotta for contrast)
- Column colors lighten one step; tints become deep muted versions
- `*-strong` tint-text tokens flip to light shades

## Typography

Google Fonts: `Unbounded` (400–800) + `Golos Text` (400–700), both with Cyrillic.

| Role | Font | Weight | Size |
|------|------|--------|------|
| Body / UI | Golos Text | 400 | 14-16px, cards 15px/1.5 (16px mobile) |
| Buttons | Golos Text | 600-700 | 13-16px |
| Meta (author, dates) | Golos Text | 400 | 13px |
| Badges / pills | Golos Text | 700 | 11-13px |
| Headings (`.font-heading`) | Unbounded | 700 | H1 28-32px (ls −0.02em), column titles 21px, tiles 16px |
| Brand/Logo | Unbounded | 800 | 18px (ls −0.01em) |
| Tabular data (timer) | Golos Text | 700 | 15px, `tabular-nums` |

## Spacing

8px base grid. Use Tailwind increments:
- `gap-1` (4px) — between inline icons
- `gap-2` (8px) — between cards, small elements
- `gap-3` (12px) — between sections in a panel
- `gap-4` (16px) — between major sections
- `py-2.5` (10px) — standard header padding
- `px-4`/`px-6` — page horizontal padding (mobile/desktop)
- `max-w-7xl` (1280px) — content max width on board
- `max-w-5xl` (1024px) — content max width on landing

## Header — Unified Structure

White (`surface-card`), `border-b`, solid. One component, two contexts:

**Site pages** (`/`, `/new`, `/changelog`, `/api`, `/feedback`):
```
[Brand]  [Features · Changelog · API · Feedback]        [EN] [Theme] [CTA "Create Board"]
```
- Nav links 14px/500; active page: 700 + `border-b-2 border-accent`
- CTA is the accent button; `/new` omits it

**Board** (`/[slug]`):
```
[Brand / Space / Board title]     [Timer chip] [Avatars] [Share] [⋯ menu]
```
- Timer chip: clock icon + 15px/700 tabular time + 64×4px accent progress bar;
  creator idle state shows minute stepper + play inside the same chip
- Participants: own avatar (32px, letter, connection dot) + `+N` overlap stack
- **Share is a visible ink button** (`btn-dark`) — copies the public link,
  shows "Copied ✓" for 2s. Never hidden in the overflow menu.
- `⋯` menu: board code, admin link, exports, API, locale/theme, delete
- Mobile: board title (Unbounded 19px) + "space · N online" subtitle,
  compact timer chip, 38px share button

**Space** (`/spaces/[slug]`):
```
[Brand / Space name  (lock badge)]        [EN] [Theme] [+ New board]
```

## Avatar / User Identity

- Own avatar in the board header: 32px circle, first letter, `bg-well`,
  connection status dot (green/red); click to edit name
- Others online collapse into a `+N` circle
- When no name set: generic user icon (NOT "?")

## Components

### Toast (AdminBanner)
- Position: `fixed bottom-6 left-1/2 -translate-x-1/2`
- Auto-dismiss: 15 seconds
- Copies **public** board/space link (NOT admin link)
- Animation: `fly y:20 duration:400`
- Z-index: 400
- `aria-live="polite"` for accessibility

### Feedback
- **FAB**: Fixed `bottom-5 right-5`, z-500, pill shape
  - Desktop: icon + "Feedback" text
  - Mobile: icon only
  - Hidden when panel is open
- **Panel**: Slide-out from right, 400px max-width
  - Overlay: `bg-black/30 backdrop-blur-sm`, z-600
  - Panel: z-601, `fly x:400 duration:350`
  - Escape key closes

### Cards (Board)
- Use `.card-board` class (bg-surface-card, 1px border, rounded-[14px], p-4 — **no shadow**)
- Text 15px/1.5 (16px on mobile)
- Action row is **always visible**: like pill (active = `pill-well` fill,
  inactive = `pill-outline`), dislike pill, comment pill with count, author right (13px muted)
- Edit/move/delete icons always visible top-right (no hover-reveal)
- Animation: `cardEnter 0.55s spring, stagger 0.05s`

### Columns
- No background fill — column header underlined with `border-b-[3px]` in the column color
- Title: Unbounded 21px + colored count
- "Add a card…" field always visible at the top of the column
- Mobile: columns are segment tabs (active tab filled with column color),
  composer pinned to the bottom of the screen (48px input + 48px accent send)

## Animation System

| Animation | Duration | Easing | Usage |
|-----------|----------|--------|-------|
| cardEnter | 0.55s | spring `(0.34, 1.56, 0.64, 1)` | Card appearance |
| tileEnter | 0.6s | spring | Board tiles in space |
| voteBounce | 0.3s | spring | Vote button feedback |
| fadeUp | 0.8s | `(0.25, 1, 0.5, 1)` | Hero entrance |
| revealUp | 0.9s | `(0.16, 1, 0.3, 1)` | Scroll section reveals |
| panelExpand | 0.3s | `(0.25, 1, 0.5, 1)` | Dropdown panels |
| toast fly | 0.4s | cubic-out | Toast appear/dismiss |
| View Transition | 0.2-0.3s | `(0.25, 1, 0.5, 1)` | Page crossfade |

**Rules:**
- Respect `prefers-reduced-motion` (all durations → 0.01ms)
- Exit animations: 60-70% of enter duration
- Stagger list items: 50ms per item, max 5 items
- No animation > 1s
- Only animate `transform` and `opacity` (no layout properties)

## Icon System

- Source: Inline SVGs (no icon library, no emoji)
- Stroke: `stroke-width="2"`, `stroke-linecap="round"`
- Size: `h-4 w-4` (16px) default, `h-3.5 w-3.5` for badges
- Color: `text-text-muted` default, `text-text-primary` on hover
- All icon buttons must have `title` and `aria-label` attributes

## Z-index Scale

| Layer | Z-index | Usage |
|-------|---------|-------|
| Header | 50 | Sticky navigation |
| Dropdown menus | 50 | Board overflow menu |
| Toast | 400 | Admin toast, notifications |
| FAB | 500 | Feedback floating button |
| Overlay | 600 | Feedback panel backdrop |
| Panel | 601 | Feedback slide-out |
| Lightbox | 700 | Image viewer |

## Accessibility

- Contrast: 4.5:1 minimum for body text, 3:1 for large text
- All icon buttons: `aria-label` + `title` tooltip
- Focus rings: visible on all interactive elements (browser default)
- Keyboard: Tab order matches visual order
- Toasts: `aria-live="polite"`
- Color alone never conveys meaning (dots + column titles + backgrounds)
- `prefers-reduced-motion`: all animations disabled

## i18n

- All user-facing strings through `t('key')`
- Both `en.json` and `ru.json` must have every key
- Mockup/placeholder text on landing page must also be localized
- Dates: use relative format or ISO (not locale-dependent formatting)

## UX & Navigation

### Page Transitions
- All page changes use View Transitions API (`onNavigate` in layout)
- Old page: `fadeOut 0.2s`, new page: `fadeIn 0.3s`
- On back/forward: data revalidated via `invalidateAll()` on `popstate`

### Navigation Flow
```
Landing (/)
  ├─→ /new → Create Board → /[slug] (board)
  ├─→ /new → Create Space → /spaces/[slug] (space)
  ├─→ /changelog
  └─→ /feedback (standalone, or panel overlay from any page)

Board (/[slug])
  ├─ Header brand → /
  ├─ Breadcrumb space link → /spaces/[slug]
  └─ Browser back → previous page (data refreshed)

Space (/spaces/[slug])
  ├─ Header brand → /
  ├─ Board tile click → /[slug]
  └─ Browser back → / (or previous)
```

### Navigation Principles
1. **Brand always goes home** — clicking "Retrospectrix" → `/`
2. **Breadcrumbs show context** — `/` → Space → Board
3. **Back button works** — data refreshed on popstate, scroll restored
4. **No dead ends** — every page has a clear path back
5. **Feedback accessible everywhere** — header icon + FAB on all pages
6. **No page reload on actions** — toasts/panels instead of navigation

### Interaction States
Every interactive element must have:
- **Default** → visible, clear affordance
- **Hover** → `bg-surface-hover` or opacity change, `transition-colors 0.2s`
- **Active/Press** → `scale-[0.97]` or `active:scale-95`
- **Focus** → browser default focus ring (do not remove)
- **Disabled** → `opacity-50`, `cursor-default`

### Scroll Behavior
- Landing page: IntersectionObserver reveals sections (blur+scale entrance)
- Board page: no scroll animations (content is interactive, not promotional)
- Lists/grids: stagger entrance with 50ms per item
- Smooth scroll to anchor links (`scroll-behavior: smooth` on html)

### Feedback Patterns
| User Action | Feedback |
|-------------|----------|
| Create board/space | Redirect + toast "Created — share it!" |
| Copy link | Button text → "Copied!" for 2s |
| Vote on card | Bounce animation + instant count update |
| Submit feedback | Panel shows checkmark + "Thanks!" |
| Delete (destructive) | Confirmation dialog first |
| Error | Red text near the field, shake animation |
| Loading | Spinner on button, button disabled |

### Mobile UX
- Header collapses to essentials (brand, menu, feedback)
- Columns stack vertically (single column layout)
- FAB: icon-only (no text label)
- Touch targets: min 44x44px
- No hover-dependent interactions

## Utility Classes

Reusable CSS classes defined in `src/app.css` (`@layer components`). Composable — combine base + size + variant. Override any property with inline Tailwind.

### Buttons

| Class | Purpose |
|-------|---------|
| `.btn` | Base: flex, gap-2, font-semibold, transition, disabled states |
| `.btn-sm` | Small: rounded-[10px], px-3.5, py-[7px], text-[13px] |
| `.btn-md` | Medium: rounded-xl (12px), px-[18px], py-2.5, text-sm |
| `.btn-lg` | Large: rounded-[14px], px-[26px], py-3.5, text-base |
| `.btn-primary` | Accent (terracotta) bg, white bold text |
| `.btn-dark` | Ink bg (text-primary), surface text — e.g. Share |
| `.btn-danger` | `bad` bg, white text |
| `.btn-secondary` | Border, surface-card bg, text-primary, hover bg |
| `.btn-ghost` | No bg/border, text-secondary, hover bg |

**Icon buttons:**

| Class | Purpose |
|-------|---------|
| `.btn-icon` | Base: flex center, rounded-lg, muted text, hover states |
| `.btn-icon-sm` | 28px (h-7 w-7) |
| `.btn-icon-md` | 32px (h-8 w-8) |
| `.btn-icon-lg` | 36px (h-9 w-9) |
| `.btn-icon-bordered` | Adds border |

**Example:** `<button class="btn btn-primary btn-md w-full">Submit</button>`

### Inputs

| Class | Purpose |
|-------|---------|
| `.input` | Base: full-width, rounded-[14px], border; focus = 1.5px ink border |
| `.input-sm` | Small: rounded-[10px], text-[13px], tight padding |
| `.input-md` | Medium: px-4, py-2.5 |
| `.input-lg` | Large: h-[54px], px-[18px], text-base |
| `.textarea` | Same as input + resize-none, 15px text |

**Example:** `<input class="input input-lg" placeholder="Title" />`

### Pills (votes, comments — always visible)

| Class | Purpose |
|-------|---------|
| `.pill` | Base: rounded-full, px-3, py-1.5, text-[13px], font-bold |
| `.pill-outline` | 1px border, muted text — inactive vote |
| `.pill-well` | Green tint fill — active like |
| `.pill-bad` | Red tint fill — active dislike |

### Cards

| Class | Purpose |
|-------|---------|
| `.card` | Base: rounded-2xl, border, bg-surface-card |
| `.card-interactive` | Adds hover lift + border-strong + shadow |
| `.card-sm` | Padding p-4 |
| `.card-md` | Padding p-5 |
| `.card-lg` | Padding p-6 |
| `.card-board` | Board card: rounded-[14px], tighter padding, shadow-sm |
| `.dropdown` | Menu container: rounded-xl, shadow-lg |
| `.dropdown-item` | Menu item: flex, text-[13px], hover bg |

### Badges

| Class | Purpose |
|-------|---------|
| `.badge` | Base: rounded-full, px-3, py-1, text-xs, font-semibold |
| `.badge-sm` | Small tag: rounded-md, text-[10px], uppercase |
| `.badge-outline` | Border + muted bg + secondary text |
| `.badge-accent` | Accent tint bg (`accent-bg`) + accent text |
| `.badge-success` | Green tint bg + `well-strong` text |
| `.badge-version` | Ink bg, surface text — latest changelog release |
| `.badge-version-outline` | Bordered — older changelog releases |

### Errors

| Class | Purpose |
|-------|---------|
| `.error-box` | Red bg, red text, rounded-lg (with dark mode) |
| `.error-box-sm` | Smaller padding + text-xs |

## Anti-patterns (DO NOT)

- **Hover-reveal actions** — every card action (votes, comments, edit, move, delete)
  is always visible; nothing hides behind hover
- Hiding primary actions in overflow menus (Share is a visible button)
- Icon-only navigation without labels
- Different header layouts on different pages
- Shadows on cards — 1px border only (modal is the exception)
- "?" as user avatar (looks like help icon)
- Copying admin links in public-facing toasts
- Stacking multiple banners (use toast instead)
- Placeholder-only form labels
- Hardcoded English text in mockups when UI is in Russian
