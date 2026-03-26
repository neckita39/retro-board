# Retrospectrix Design System

Source of truth for UI consistency across all pages.

## Colors

### Light Mode
| Token | Hex | Usage |
|-------|-----|-------|
| `surface` | `#f9f9f9` | Page background |
| `surface-card` | `#ffffff` | Cards, panels, header |
| `surface-hover` | `#f2f2f2` | Hover backgrounds |
| `text-primary` | `#1a1a1a` | Headings, body text |
| `text-secondary` | `#5c5c5c` | Descriptions, meta |
| `text-muted` | `#858585` | Placeholders, disabled |
| `border` | `#e2e2e2` | Borders, dividers |
| `border-strong` | `#cfcfcf` | Focus borders |
| `accent` | `#0d9488` | CTA buttons, links, primary actions |
| `accent-hover` | `#0f766e` | Accent hover state |
| `well` | `#22c55e` | Green column dot |
| `well-bg` | `#f0fdf4` | Green column background |
| `bad` | `#ef4444` | Red column dot |
| `bad-bg` | `#fef2f2` | Red column background |
| `improve` | `#3b82f6` | Blue column dot |
| `improve-bg` | `#eff6ff` | Blue column background |

### Dark Mode
Overrides in `.dark` class. Key differences:
- `accent` becomes `#2dd4bf` (lighter teal for contrast)
- Column backgrounds become deep saturated versions
- Surface uses dark grays (#141414, #1c1c1c)

## Typography

| Role | Font | Weight | Size |
|------|------|--------|------|
| Body | Nunito Sans | 400 | 14-16px |
| Labels | Nunito Sans | 500-600 | 12-13px |
| Headings | Varela Round | 400 (only weight) | 18-48px |
| Brand/Logo | Varela Round | 700 | 15px |
| Tabular data | Nunito Sans | 700 | inherit, `tabular-nums` |

**Do NOT change fonts.** User explicitly locked Nunito Sans + Varela Round.

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

**Every page must use this header layout:**

```
[Brand + Breadcrumb]          [Context Actions] | [Feedback] [Locale] [Theme]
```

### Zones

1. **Left: Brand + Breadcrumb**
   - Brand: `Retrospectrix` (Varela Round, 15px, bold) — always links to `/`
   - Breadcrumb: `/` separator → page context
   - Examples: `Retrospectrix / Sprint 42` or `Retrospectrix / Team Alpha / Sprint 42`

2. **Right: Actions (order is fixed)**
   - Context actions (board-specific): user count, board menu, user avatar
   - Divider: 1px vertical line, `h-4 bg-border`
   - Global actions (always present): Feedback icon, Locale toggle, Theme toggle

### Mobile (< 640px)
- Collapse locale + theme into board menu overflow
- Keep: brand, breadcrumb (truncated), board menu, feedback icon

### Pages and their context actions:
| Page | Context Actions | Global Actions |
|------|----------------|----------------|
| Landing `/` | — | Feedback, Locale, Theme |
| Create `/new` | — | Feedback, Locale, Theme |
| Board `/[slug]` | UserCount, BoardMenu, Avatar | Feedback, Locale, Theme |
| Space `/spaces/[slug]` | SpaceMenu (if admin) | Feedback, Locale, Theme |
| Changelog | — | Feedback, Locale, Theme |
| Feedback `/feedback` | — | Locale, Theme |

### What NOT to put in the header:
- "Create board" CTA (belongs in page content)
- "Help" icon (the landing page IS the help — brand link goes to `/`)
- "?" avatar without name (confusing — looks like help icon)

## Avatar / User Identity

- When user has set a name: show first letter in accent circle (28px)
- When no name set: show generic user icon (NOT "?")
- Avatar only appears on board page (where names are relevant)

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
- Background: `bg-surface-card`
- Border: `1px solid border`
- Radius: `rounded-[10px]`
- Hover: slight lift + shadow
- Animation: `cardEnter 0.55s spring, stagger 0.05s`

### Columns
- Background: `bg-{color}-bg/50` (50% opacity column color)
- Radius: `rounded-2xl`
- Padding: `p-2.5`
- Header: dot indicator + title + count

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

## Anti-patterns (DO NOT)

- Icon-only navigation without labels
- Different header layouts on different pages
- Hiding theme/locale toggle on some pages
- "?" as user avatar (looks like help icon)
- Copying admin links in public-facing toasts
- Stacking multiple banners (use toast instead)
- Placeholder-only form labels
- Hardcoded English text in mockups when UI is in Russian
