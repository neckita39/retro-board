# Retrospectrix Design System

Source of truth for UI consistency across all pages. Tokens and utility classes
live in `src/app.css`; this file explains the rules behind them. The generated
`design-system/retrospectrix/MASTER.md` is void — do not follow it.

## The five rules

Five scales replace the old scatter. Every screen and shared component follows all five.

1. **Radii** — 8 · 12 · 16 · 24 · full.
   8 (`rounded-lg`) = icon buttons, small badges, image previews · 12 (`rounded-xl`) = every
   control of any size (buttons, inputs, chips, summary rows, comment bubbles, mobile tabs) ·
   16 (`rounded-2xl`) = cards, tiles, panels, toasts, dropdown menus · 24 (`rounded-3xl`) =
   modal · `rounded-full` = pills, avatars, badges, FAB.
   `rounded` (4px) and `rounded-[3px]` exist only for the tiny column stripes on the create screen.
   Forbidden: `rounded-sm`, `rounded-md`, `rounded-[10px]`, `[14px]`, `[18px]`, `[20px]`.
2. **Heights** — 32 · 38 · 54. One height per row.
   32 (`h-8`) = controls inside cards and summary rows · 38 (`h-[38px]`) = header, toolbars,
   inline forms, labelled toggle · 54 (`h-[54px]`) = creation forms and the modal.
   Heights are set explicitly (`h-*`), never derived from padding. Mobile touch exceptions:
   the composer is 48, vote/comment pills and the card's task badge are 40, column tabs are `min-h-11`.
3. **Shadows** — three levels, all ink `rgba(33,30,26,…)`.
   Level 0 = 1px `border-border` only (cards, tiles, panels, chips) · level 1 = `shadow-1`
   (`0 4px 14px .08` — dropdown menus, toasts, FAB, tooltips) · level 2 = `shadow-2`
   (`0 14px 34px .24` — modal, feedback side panel).
   No `shadow-sm/md/lg/xl/2xl`, no colored glows, no glow on selected or focused elements.
4. **Color** — terracotta (`accent`) is the one primary action on a screen, the timer and the
   active nav item. Green / red / blue (`well` / `bad` / `improve`) mean column semantics only.
   The fourth column (4L «Longed for», Sailboat «Island») is plum (`plum`), never accent.
   AI is the `improve` family (badge, star icon, frames, spinner) — no purple gradient anywhere.
   Avatars are ink (`bg-text-primary`). Overlays use `bg-scrim` / `bg-scrim-strong`.
   Only tokens: no `red-500`, `black/30`, `white`, hex values, and no opacity tints of tokens
   such as `text-text-primary/85` or `bg-surface-card/50`.
   The one sanctioned use of `white` is *on a saturated fill that stays saturated in both themes*:
   `text-white` on `bg-accent` / `bg-bad` / tone tabs, and the `bg-white` knob of `ToggleSwitch`
   on its `accent` / `border-strong` track (a `surface-card` knob would vanish on the dark track).
   Never `white` as a surface, border, overlay or tint (`white/80`).
5. **Font sizes** — eight sizes: 11 · 13 · 14 · 15 · 17 · 21 · 32 · 40 (see Typography).
   16 is allowed only on 54px form controls; 18 only for the brand.

## Colors

Warm "paper" palette. Green/red/blue are reserved for column semantics;
terracotta is the only action accent; plum is the fourth column.

### Light Mode
| Token | Value | Usage |
|-------|-------|-------|
| `surface` | `#F7F6F2` | Page background, chips (timer, focus timer), comment bubbles |
| `surface-card` | `#FFFFFF` | Cards, tiles, panels, header, toasts, Summary section |
| `surface-hover` | `#ECEBE5` | Hover backgrounds, neutral fills (comment counter, `+N`, unnamed avatar) |
| `text-primary` | `#211E1A` | Ink — headings, body text, dark buttons, avatars, tooltips |
| `text-secondary` | `#6B6A61` | Descriptions, meta, breadcrumb space link, chip icons |
| `text-muted` | `#96958A` | Placeholders, disabled, icon buttons at rest, author names |
| `border` | `#E5E4DC` | Borders, dividers, timer bar track |
| `border-strong` | `#D9D8CF` | Hover borders, dashed affordances, breadcrumb separators, toggle off |
| `accent` | `#C4552B` | Terracotta — primary button, timer fill, active nav, selected frame |
| `accent-hover` | `#A94620` | Accent hover state |
| `accent-bg` | `#F7E7DE` | Accent tint — «Recommended», «live now», plus circles, focused score badge |
| `well` | `#4C8C6A` | Green column: underline, count, mood bar, stripes, connection dot |
| `well-bg` | `#EDF4EF` | Green tint — active like pill, column label, success toast icon |
| `well-strong` | `#3A7355` | Text on green tint |
| `bad` | `#C05B4D` | Red column + destructive actions, errors, timer when almost up |
| `bad-bg` | `#F5E9E5` | Red tint — active dislike pill, error box, delete hover |
| `bad-strong` | `#8A3D30` | Text on red tint |
| `improve` | `#5B72C0` | Blue column + everything AI (star, 2px frames, spinner) |
| `improve-bg` | `#E9EDF6` | Blue tint — AI badge, info toast icon |
| `improve-strong` | `#3A4C87` | Text on blue tint |
| `plum` | `#9A5B8C` | Fourth column (4L, Sailboat): underline, count, stripe, mood segment |
| `plum-bg` | `#F3E7EF` | Plum tint — column label, move chip, drop-target highlight |
| `plum-strong` | `#6F3A63` | Text on plum tint |
| `scrim` | `rgba(33,30,26,0.4)` | Overlay under the modal and the feedback panel |
| `scrim-strong` | `rgba(33,30,26,0.85)` | Lightbox backdrop |
| `shadow-1` | `0 4px 14px rgba(33,30,26,0.08)` | Level 1 shadow (utility `shadow-1`) |
| `shadow-2` | `0 14px 34px rgba(33,30,26,0.24)` | Level 2 shadow (utility `shadow-2`) |

### Dark Mode
Overrides in the `.dark` class, derived from the same warm palette:
- Surfaces are warm dark browns (`#191713`, `#211E1A`, `#2B2721`); borders `#343029` / `#443F36`
- `accent` becomes `#D97A50` (lighter terracotta for contrast), `accent-bg` `#3C2A20`
- Column colors lighten one step (`well #5FA37D`, `bad #CE7263`, `improve #7C90D6`,
  `plum #B57AA6`); tints become deep muted versions; `*-strong` tint-text tokens flip to light shades
- Scrims and shadows stay ink — they are not redefined

### Art tokens (format illustrations)
A format illustration is the same picture in both themes, so everything drawn on top of it uses
`art-*` tokens that have **no** `.dark` override (like the code block tokens of the API page).
Values are the light-theme ones; the tile frame (`border-border`, hover, selected accent) is not
art and follows the theme.

| Token | Value | Usage |
|-------|-------|-------|
| `art-canvas` | `#F4F4FE` | Tile fill. `scripts/format-art.mjs` shifts the empty part of every picture to this colour, so the tile extends the picture without a seam |
| `art-ink` | `#211E1A` | Titles on illustrated tiles (15.2:1 on the canvas) |
| `art-ink-secondary` | `#6B6A61` | Taglines, descriptions, chip text (5.0:1) |
| `art-chip` / `art-chip-border` | `#FFFFFF` / `#E5E4DC` | Meta chips on `/formats` |
| `art-accent` / `art-accent-bg` | `#A94620` / `#F7E7DE` | «Learn more» and «Recommended» — the light `accent-hover`: `accent` itself is 4.1:1 on the canvas |
| `art-well` / `art-bad` / `art-improve` / `art-plum` | `#4C8C6A` / `#C05B4D` / `#5B72C0` / `#9A5B8C` | Column stripes on picker options (`TONE[tone].art`); the dark-theme tones fall to 2.7–3.1:1 on the canvas |

## Typography

Self-hosted (`static/fonts/`, declared in `src/fonts.css`): `Unbounded` (400–800) +
`Golos Text` (400–700), both with Cyrillic. `.font-heading` = Unbounded.

| Size | Class | Font / weight | Where |
|------|-------|---------------|-------|
| 11 | `text-[11px]` | Golos 700 uppercase | `badge-sm` (column labels, «Recommended», AI badge), «live now» tag |
| 13 | `text-[13px]` | Golos 400–700 | Meta (author, dates, tile meta), pills, `btn-sm`, `input-sm`, dropdown items, toast action, name-card subtitle, mobile board subtitle, FocusTimer time, error text |
| 14 | `text-sm` | Golos 400–600 | UI: `btn-md`, `input-md`, nav links, breadcrumb, labels, toggle label, toast text, column count, tile «New board» label |
| 15 | `text-[15px]` | Golos 400 | Body: card text (1.5), summary rows (1.4 / focused 1.6), page subtitles, space meta line, header timer time (700), «Add a card…», mobile composer |
| 16 | `text-base` | Golos 400–700 | Only on 54px controls: `input-lg`, `btn-lg` |
| 17 | `text-[17px]` | Unbounded 700 / Golos 700 | Tile titles (1.3, `line-clamp-2`), mobile board title (Unbounded 800), feedback success line |
| 18 | `text-[18px]` | Unbounded 800, ls −0.01em | Brand only |
| 21 | `text-[21px]` | Unbounded 700 | Section and column headings, modal / panel titles, create-screen type cards, password form |
| 26 / 32 | `text-[26px] sm:text-[32px]` | Unbounded 700, ls −0.02em | Page title (space H1, create, changelog) |
| 40 | landing hero | Unbounded | Landing hero only |

Removed from the three screens and shared components: 10, 12, 13.5, 19, 20, 22, 24, 30, 34
(`text-xs`, `text-lg`, `text-xl` are not used there). Tabular numbers (`tabular-nums`) on every
counter, timer and score.

## Radius scale

| px | Tailwind | Used for |
|----|----------|----------|
| 3–4 | `rounded-[3px]`, `rounded` | Column stripes on the create screen and in FormatPicker only |
| 8 | `rounded-lg` | `btn-icon`, `badge-sm`, `badge-version`, image previews, `error-box`, mobile brand square, space placeholder squares |
| 12 | `rounded-xl` | `btn-*`, `input-*`, `textarea`, timer chips, FocusTimer chip and tooltip, summary rows, comment bubbles, mobile column tabs, `btn-icon-lg`, labelled toggle, rename input |
| 16 | `rounded-2xl` | `card`, `card-board`, tiles, panels, toasts, `dropdown`, name card, «Add a card…», expanded card form, analysis frame, lightbox image |
| 24 | `rounded-3xl` | NewBoardModal, BitrixTaskModal (a square sheet on phones) |
| full | `rounded-full` | `pill`, `badge`, `TaskBadge`, avatars, `+N`, FAB, toast icon circles, mood bar segments, switch |

## Height scale

| px | Classes | Rows |
|----|---------|------|
| 20 | `badge-sm` | Column labels, tags inside rows |
| 22 | inline | «live now» tag on tiles |
| 24 | inline | Toast icon circle, «Add a card…» plus circle |
| 28 | `btn-icon-sm`, `badge`, summary comment pill, `TaskBadge size="sm"` | Inside cards, summary rows, chips; lock badge next to the space H1 |
| 32 | `btn-sm`, `input-sm`, `btn-icon-md`, `pill`, avatar, `+N`, FocusTimer chip, name-card avatar, `TaskBadge` | Card action rows, summary controls, comment form, header participants |
| 38 | `btn-md`, `input-md`, `btn-icon-lg`, timer chips, ToggleSwitch, FAB, ⋯ button, mobile share, Bitrix24 trigger | Header, toolbars, inline forms, name card, password and Bitrix24 panels, feedback panel |
| 46 | «Add a card…» affordance | Top of each column |
| 48 | Mobile composer input / send / attach | Bottom of the screen on phones |
| 54 | `btn-lg`, `input-lg` | Create screen, NewBoardModal, BitrixTaskModal, space password form |

## Spacing

8px base grid, Tailwind increments.

- `gap-0.5` (2px) — card action icon group · `gap-1` (4px) — mood bar segments, stripes
- `gap-2` (8px) — summary rows, comment form, toast stack (10px), pills in a row
- `gap-3` (12px) — between cards in a column, header items, name-card / tile content (14px)
- `gap-4` (16px) — tile grid, feedback form fields · `gap-5` (20px) — board columns
- `gap-7` (28px) — space page sections, create page sections
- Header: `px-4 py-2.5 sm:px-7 sm:py-3`, inner `max-w-[1360px]`
- Board grid and name card: `max-w-[1360px]`, `p-4 sm:p-6 lg:px-7` (name card `px-4 pt-4 sm:px-6 lg:px-7`)
- Summary: same container, `p-4 sm:p-6 lg:px-7`, `pb-32` on mobile (room for the composer)
- Space page: `max-w-[1360px]`, `px-4 sm:px-8 lg:px-14`, `pt-9 sm:pt-10`
- Create page: `max-w-[720px]`, `pt-10 sm:pt-14`; changelog `max-w-[760px]`
- Card padding `p-4`; tile `p-5` (AI tile `p-[19px]` inside its 2px frame); panel `p-4`; type card `p-6`; modal `p-6 sm:p-8`

## Header — Unified Structure

White (`surface-card`), `border-b`, sticky, z-50. One component (`Header.svelte`), three
contexts. Every control in the right-hand row is 38px with radius 12.

**Site pages** (`/`, `/new`, `/formats`, `/how-to-run-a-retro`, `/changelog`, `/api`, `/feedback`):
```
[Brand]  [Formats · How to run · Changelog · API · Feedback]      [GitHub] [EN] [Theme] [CTA]
```
- Brand: Unbounded 18/800; below `sm` it collapses to a 28px ink square with the first letter
  (the name stays in the accessibility tree)
- Nav (from `lg`): 14/500 secondary, `gap-[22px]`; active page: 700 ink + `border-b-2 border-accent`
- GitHub, EN and Theme are `btn-icon btn-icon-lg btn-icon-bordered` (38, bordered)
- CTA «Create board» = `btn btn-primary btn-md` (`showCreate`); `/new` shows nav only, no CTA

**Board** (`/[slug]`):
```
[Brand / Space / Board title ✎]        [Timer chip] [Avatar +N] [Share] [⋯]
```
- Breadcrumb: brand · `/` separators in `border-strong` · space link 14/500 secondary ·
  board title 14/600 ink (`AiBadge` after it on an analysis board) · pencil `btn-icon btn-icon-sm`
  (28, borderless, creator only; inline rename input `input input-sm`)
- Timer chip (running): `h-[38px] rounded-xl border border-border bg-surface pl-3.5`, clock 16
  secondary (a 7px dot below `sm`), time 15/700 tabular ink, bar 64×4 (`bg-border` track, accent
  fill, `bad` when ≤20% or expired + `timer-pulse`), stop = `btn-icon btn-icon-sm` glyph 12.
  Idle (creator): stepper `−  [n]  +` and a `btn-primary` play button fill the same 38px chip
- Participants (from `md`): ink avatar 32 + `+N` counter (see Avatar)
- **Share is a visible ink button** (`btn btn-dark btn-md`, link icon, «Copied ✓» for 2s) — never
  in the overflow menu. Below `md` it is a 38×38 ink square
- `⋯` = 38×38 bordered `rounded-xl`; the `dropdown` (w-52) holds: copy code, admin link, JSON,
  Markdown, API, «Space analysis» (`AnalyzeButton variant="menu"`, star `text-improve`),
  EN + Theme toggles, rename, «Connect Bitrix24» (space creator, space without a connection: link
  glyph 16 muted → `/spaces/{slug}?bitrix=1`), delete (`text-bad hover:bg-bad-bg`, inline confirm
  with `btn-sm`)
- Mobile: title Unbounded 17/800 (links to the space or `/`), subtitle 13 muted
  «space · N online»; compact timer chip; 38px share square; menu

**Space** (`/spaces/[slug]`):
```
[Brand]                       [EN] [Theme] [✦ Space analysis] [+ New board]
```
- The space name is shown once — in the page H1, not in the header; no lock badge in the header;
  no GitHub button (`showNav` is off)
- «Space analysis» = `btn btn-secondary btn-md` with a 16px star `text-improve` (label hidden
  below `sm`); «New board» = `btn btn-primary btn-md` with a plus (label hidden below `sm`)
- Page heading row: H1 Unbounded `text-[26px] sm:text-[32px]` `tracking-[-0.02em]` →
  lock `badge badge-outline` (28px pill, glyph 12, `space.locked`) when protected → pencil
  `btn-icon btn-icon-sm` (creator) → success badge after a password change; meta line 15 secondary.
  Right (creator): «Bitrix24» panel trigger (see Bitrix24) + labelled `ToggleSwitch` «Password» (38)
  + delete `btn-icon btn-icon-lg btn-icon-bordered` (hover `bad-bg`/`bad`); confirm state = 13
  secondary text + `btn-danger btn-md` + `btn-secondary btn-md`
- Rename input: `input font-heading h-auto px-3 py-1 text-[26px] sm:text-[32px] font-bold`
- Password panel (collapsible): `rounded-2xl border border-border bg-surface-card p-4`,
  description 14 secondary, `input input-md`, `btn-primary`/`btn-danger btn-md` + `btn-secondary btn-md`,
  error 13 `text-bad` with `shake`. The Bitrix24 panel uses the same frame; one panel is open at a
  time, and the delete confirm collapses both

## Avatar / User Identity

- Own avatar in the board header: 32px circle, first letter 13/700, **ink** (`bg-text-primary
  text-surface`), connection dot 10px (`h-2.5 w-2.5`, `bg-well` / `bg-bad`) with a 2px
  `border-surface-card` ring; click to edit the name (`input input-sm w-28`)
- No name yet: `bg-surface-hover text-text-muted` circle with the 16px user icon (never "?")
- Others online collapse into a `+N` counter: 32px pill, `min-w-8`, `bg-surface-hover
  text-text-secondary`, 13/700 tabular, capped at `99+`
- The name card reuses the same idiom: grey user circle → ink letter circle once saved

## Components

### Toast (`Toasts.svelte` + `toastStore`)
One notification system for the whole app — no bottom banners, no `AdminBanner`.
- Stack: `fixed right-4 top-[68px] sm:top-[76px] z-40` (under the sticky header, so an open ⋯ menu stays on top), width `min(360px, 100vw − 2rem)`,
  `gap-2.5`, under the header so it never covers its buttons; lives in the layout, so it survives
  navigation («analysis ready» catches up with you on any page)
- Card: `rounded-2xl border border-border bg-surface-card py-3 pl-4 pr-3 shadow-1`, `gap-3`,
  `card-enter` animation; `data-testid="toast"`, `data-kind`
- Icon: 24px circle — success = `well-bg`/`well-strong` ✓, error = `bad-bg`/`bad-strong` !,
  info = `improve-bg`/`improve-strong` ★ (glyph 12)
- Text 14/1.4 ink; action 13/700 accent «label →»: `{ label, href }` renders a link
  (`external: true` adds `target="_blank" rel="noopener"` — «Task #N created → Open»),
  `{ label, onClick }` a button whose label turns into `copy.copied` for 2s after a click
- Close = `btn-icon btn-icon-sm` glyph 12, `aria-label` = `toast.close`
- `role="status"` (`alert` for errors); timeouts 8s default, 12s error, 15s for the
  «Board / space created — share the link» toast, whose action copies the **public** URL
  (the `?admin` parameter is stripped from the address first)
- API: `toastStore.push({ kind: 'info' | 'success' | 'error', text, action?, timeoutMs? })` → id;
  `dismiss(id)`, `clear()`

### Name card (`NamePrompt.svelte`)
Name prompt and onboarding tip are **one** card under the board header (`Onboarding.svelte` is gone).
- Container aligned with the board grid: `mx-auto max-w-[1360px] px-4 pt-4 sm:px-6 lg:px-7`
- Card: `flex flex-wrap items-center gap-3.5 rounded-2xl border border-border bg-surface-card px-4 py-3`
- 32px circle `bg-surface-hover text-text-muted` with the 16px user icon; title 14/600 ink
  (`name.title`); subtitle 13/1.4 secondary (`name.desc`)
- Form: `input input-md` (220px from `sm`, a full-width row on phones) + Save `btn btn-dark btn-md`
  + Skip as a 13/500 muted text button
- Saved: the circle becomes the ink letter avatar, a ✓ in `well` + `name.greeting`, then the
  card hides after ~2s. Shown only while `retro_name` is unset; Skip stores an empty name

### Cards (Board)
- `.card-board` (`rounded-2xl border border-border bg-surface-card p-4`) + `card-interactive` —
  **no shadow**; text 15/1.5 (`whitespace-pre-wrap`)
- Action icons top-right, **always visible**: a group with `-mt-1.5 -mr-1.5 gap-0.5` of
  `btn-icon btn-icon-sm` (28, radius 8, glyph 16): task = square with a check (first; board or
  space creator, connected space, card without a task), move = swap arrows, edit = pencil,
  delete = ✕ (first click → `bg-bad text-white` confirm state for 3s). Each icon keeps `title` +
  `aria-label` and shows an `.icon-tip` tooltip. Move opens a row of `badge-sm` tone
  chips for the other columns
- Image preview `rounded-lg` (8), `max-h-48`, opens the lightbox
- Action row (`mt-3 gap-2`): like / dislike `pill` (`pill-outline` inactive, `pill-well` /
  `pill-bad` active, `vote-bounce`), comment counter = `pill pill-neutral` when > 0 or a
  borderless `pill text-text-muted hover:bg-surface-hover` with `comment.add` when 0 —
  terracotta stays with actions and the timer; `TaskBadge` (32) after the comment pill; author
  right (`ml-auto`), 13 muted. Pills and the task badge are 40px on phones, where the row wraps
  (`flex-wrap gap-2`) and the badge moves to the second line together with the author
- Comments: collapsible list of `rounded-xl bg-surface px-3 py-2 text-[13px]` bubbles; the form
  is a 32px row: attach `btn-icon btn-icon-sm` + `input input-sm` + `btn btn-dark btn-sm`
- Edit mode: `textarea bg-surface px-3 py-2`; Enter saves, Escape cancels
- Draggable between columns (`rotate-1 scale-[0.97] opacity-40` while dragging)
- Animation: `cardEnter 0.55s spring`, stagger 50ms

### Icon tooltip (`.icon-tip`)
- The FocusTimer tooltip idiom for icon buttons, one class in `src/app.css`: `rounded-xl
  bg-text-primary px-3 py-2 text-[13px] text-surface shadow-1`, `mt-1.5` under the icon group,
  aligned to its right edge; appears over 150ms on hover (only on devices with real hover,
  `@media (hover: hover)`) and on `:focus-visible`
- Used on all four card icons (task, move, edit, delete); the button keeps `title` + `aria-label`,
  the tooltip repeats the same text (its content comes from `aria-label`)

### «Add a card…» (`CardForm.svelte`)
- Collapsed: a dashed affordance at the top of every column — `h-[46px] rounded-2xl
  border-[1.5px] border-dashed border-border-strong px-3.5 text-[15px] text-text-secondary
  hover:border-accent` with a 24px `bg-accent-bg text-accent` plus circle (glyph 12). Same idiom
  as the «New board» tile
- Expanded: `rounded-2xl border-[1.5px] border-text-primary bg-surface-card p-3.5`, borderless
  15px textarea, attach `btn-icon btn-icon-sm`, Cancel `btn btn-secondary btn-sm`, Add `btn btn-primary btn-sm`
- Mobile composer (pinned to the bottom, z-40): 48px `rounded-xl bg-surface` input, 48×48 accent
  send `rounded-xl`, 48×44 attach — heights stay 48 for touch

### Columns
- No background fill — header underlined with `border-b-[3px]` in the column tone (`TONE[tone].border`)
- Title Unbounded 21/700 + count `text-sm font-semibold tabular-nums` in the tone color +
  sort `btn-icon btn-icon-sm ml-auto` (glyph 14, `text-accent` when sorting by votes)
- Column `gap-3`, cards `gap-3` (12px); the whole column is a drop target with a dashed
  `outline-border-strong` (solid tone outline while hovering)
- Tones: `well` / `bad` / `improve` / `plum` from `board-formats.js` via `TONE` in `src/lib/formats.ts`
  (`border`, `text`, `badge`, `tab`, `outline`, `bar` — `bar` is the solid color for stripes and mood bars)
- Mobile: columns are segment tabs (`min-h-11 rounded-xl text-[13px]`, active = `TONE.tab` solid
  fill with white text), one column visible at a time, composer pinned to the bottom
- Analysis board: the columns grid gets `md:rounded-2xl md:border-2 md:border-improve` — a flat
  blue frame, no gradient, none on phones

### Summary («Итоги», `Summary.svelte` / `SummaryRow.svelte` / `FocusTimer.svelte`)
- Section: `border-t border-border bg-surface-card` (solid), same 1360px container as the board
- Title Unbounded 21/700; while a discussion runs, `summary.discussing` («Discussing · n of N»)
  next to it in 13/600 muted tabular — visible to everyone; creator controls at the right:
  «Discuss» = `btn btn-primary btn-sm`, «End discussion» = `btn btn-secondary btn-sm`
- Column labels = `badge-sm` with the tone badge classes (20px, radius 8, uppercase)
- Row: `rounded-xl border border-border bg-surface-card px-3.5 py-2.5`, rows `gap-2`; score
  13/600 muted `min-w-6` centred (✓ in `well` once discussed), text 15/1.4 ink, author 13 muted
  (yields space first: `max-w-28 truncate`), task link «#123» (`TaskBadge size="sm"`, 28,
  `pointer-events-auto` so the click is not swallowed by the focus-jump layer),
  comment pill 28px (`h-7 rounded-full px-2.5 text-[13px] font-semibold`, `bg-surface-hover
  text-text-primary` when > 0, muted and transparent otherwise); dimmed rows `opacity-45`
- Focused row: `border-2 border-accent px-4 py-3.5`, **no glow**; top line = score
  `badge-sm badge-accent tabular-nums`, position 13/600 muted, author 13 muted, FocusTimer at the
  right; text 15/1.6; controls row `mt-3 border-t pt-2.5`: «← Back» `btn btn-secondary btn-sm`,
  «Next →» `btn btn-primary btn-sm` (on the last card: «End discussion»), «To task»
  `btn btn-secondary btn-sm` with a 14px glyph (creator, connected space, no task yet) that turns
  into the 32px `TaskBadge` once the task exists (both `pointer-events-auto`, the row wraps),
  comment pill `ml-auto`
- FocusTimer chip = the header timer idiom at 32: `h-8 rounded-xl border border-border bg-surface
  px-2.5 gap-2`, clock 14 secondary, time 13/700 tabular, bar 48×4, no shadow; its tooltip
  `rounded-xl bg-text-primary text-surface text-[13px] shadow-1` (hover, focus or tap to pin)

### Tiles (space, `SpaceBoardGrid.svelte`)
- Toolbar (38px): sort = `btn btn-secondary btn-md pr-3.5` with a 14px muted chevron (rotated
  180° for «oldest»); search = `w-full max-w-[260px]` wrapper, 16px muted icon at `left-3`,
  `input input-md pl-9 pr-3`
- Grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`
- Tile: `min-h-[150px] rounded-2xl border border-border bg-surface-card p-5 gap-3.5`,
  hover `border-border-strong` + lift, `active:scale-[0.98]`; title Unbounded 17/700
  `leading-[1.3] line-clamp-2` (full title on hover only when truncated)
- Bottom block: mood bar `h-[5px] gap-1` of `rounded-full` segments `bg-well` / `bg-bad` /
  `bg-improve` / `bg-plum`, flex-weighted by card count per column tone (`src/lib/mood.ts`);
  empty board = one `bg-surface-hover` segment. Meta row 13 muted: `AiBadge` (analysis boards),
  «live now» tag `h-[22px] rounded-full bg-accent-bg px-[9px] text-[11px] font-bold text-accent`
  (boards under 24h old, never the analysis board), «N cards», relative date at the right
- «New board» tile: dashed `border-[1.5px] border-dashed border-border-strong text-accent
  hover:border-accent`, 40px `bg-accent-bg` circle with an 18px plus, label 14/700
- Analysis tile (ready / pending / failed): the same tile with a flat `border-2 border-improve`
  frame and `p-[19px]` so it stays the size of its neighbours. Pending: 16px spinner
  `text-improve` + 13/600 secondary text + `AiBadge`. Failed: dismiss ✕ `btn-icon btn-icon-sm`,
  error 13 `text-bad`, «Retry» `btn btn-secondary btn-sm` + `AiBadge`
- `tileEnter` animation (70ms stagger, max 8) only on the first render of the list per session

### Format tiles (`FormatTile.svelte`, `FormatPicker.svelte`, `.format-art`)
- Pictures: `src/lib/assets/format-art/{id}.webp`, 1200×400 (3:1), one per visible format including
  classic, made by `scripts/format-art.mjs`. `formatArt(id)` / `formatArtBackground(id)` in
  `src/lib/format-art.ts` import them through Vite (hashed `/_app/immutable/` URL, year-long
  immutable cache). A decorative CSS background: no `alt`, no layout shift, 7–11 KB each
- `.format-art` = `rounded-2xl border border-border bg-art-canvas`, picture `auto 100%` at
  `right center`: the whole illustration fits the tile height, the rest of the tile is `art-canvas`.
  The illustration is the right 56 % of the picture, i.e. ≈ 1.68 × picture height, so the text
  column is capped at `calc(100% − illustration − gap)` for a known picture height
- `FormatTile` — links on `/formats` (with meta chips), the home page and `/how-to-run-a-retro`.
  From `md`: `min-h-[168px] p-6`, text `max-w-[calc(100%-300px)]` (282 illustration + 18 gap);
  title Unbounded 17/700 `art-ink` `leading-[1.3]`, tagline 14 `art-ink-secondary`, chips `badge
  border border-art-chip-border bg-art-chip text-art-ink-secondary`; hover = `card-interactive`
  (lift + `border-border-strong`), never a fill. Below `md` (`.format-art-stack`) the picture is a
  full-width 3:1 band under the text. Grids: `/formats` and the guide one column, home one column
  and two from `xl`
- `FormatPicker` option = `.format-art`. Full (`/new`) = `.format-art-foot`: from `sm`
  `min-h-[112px] p-4`, text `max-w-[calc(100%-204px)]`; below `sm` the picture is 72px high in the
  bottom-right corner (80px bottom padding) and «Learn more» sits next to it
  (`max-sm:absolute max-sm:bottom-4 max-sm:left-4`). Compact (modal) = `.format-art-row p-3`: the
  picture is always 48px high at the right (illustration ≈ 81px), text `max-w-[calc(100%-86px)]` at
  every width — a row that wraps on a phone does not grow under the picture. Never give compact rows
  the corner: 80px padding per row pushed the modal to 1004px on a 375px phone
- Never on an illustrated tile: a hover fill (`hover:bg-surface-hover`), tints, or theme tokens
  (`text-text-primary`, `badge-accent`, `bg-well`) for anything drawn over the picture

### Create screen (`/new`, `FormatPicker.svelte`)
- H1 26/32, subtitle 15 secondary; content `max-w-[720px]`
- Type cards: `rounded-2xl border bg-surface-card p-6 gap-3`; **selected** = `border-accent
  shadow-[inset_0_0_0_1px_var(--color-accent)]` (a 2px terracotta frame without layout shift, no
  glow, no corner check badge); unselected = `border-border hover:border-border-strong`.
  Column stripes are **solid**: `h-[34px] w-3.5 rounded bg-well / bg-bad / bg-improve`; the space
  card shows 34px `rounded-lg bg-surface-hover` squares + one dashed. Title Unbounded 21, text
  14/1.5 secondary, AI line = `<AiBadge label="AI" />` + 13/600 secondary
- Field label 14/600; `input input-lg`; submit `btn btn-primary btn-lg w-full`; note 13 muted;
  «Already have a link?» 14 muted → `input input-md` + `btn btn-secondary btn-md`
- FormatPicker: legend 14/600, one column `gap-2` (`compact` = no descriptions); option = an
  illustrated tile (see Format tiles) with `gap-2` and the same selected / unselected idiom — the
  inset accent shadow is painted over the background picture, so the 2px frame stays whole;
  stripes `h-5 w-2.5 rounded-[3px] {TONE[tone].art}` (plum for the fourth column of 4L and
  Sailboat), title Unbounded 15/700 `art-ink`, «Recommended» = `badge-sm bg-art-accent-bg
  text-art-accent`, description 13/1.5 `art-ink-secondary`, «Learn more» 13/600 `art-accent`
- Password toggle on `/new` = `ToggleSwitch` in a `self-start` wrapper (it is inline now)

### Modal (`NewBoardModal.svelte`)
- Overlay `fixed inset-0 z-[70] bg-scrim p-4` (`modalFadeIn`); card `w-[480px] rounded-3xl
  bg-surface-card p-6 sm:p-8 shadow-2 gap-[18px] max-h-full overflow-y-auto` (`modalZoomIn`),
  `role="dialog"` — on a short phone screen the card scrolls instead of being cut off
- Title Unbounded 21, context line 14 secondary, close `btn-icon btn-icon-lg btn-icon-bordered`
  (glyph 16); label 14/600; `input input-lg bg-surface`; `FormatPicker compact`; hint 13/1.5 muted;
  buttons `btn btn-secondary btn-lg flex-1` + `btn btn-primary btn-lg flex-[2]`; Escape closes

### Toggle switch (`ToggleSwitch.svelte`)
- A labelled control in a 38px bordered frame: `inline-flex h-[38px] items-center gap-2.5
  rounded-xl border border-border bg-surface-card pl-3 pr-3.5 hover:bg-surface-hover`
- Switch 36×20, `bg-accent` on / `bg-border-strong` off, 16px `bg-white` knob (the documented
  exception to «only tokens» — white on a saturated track, see rule 4), spring slide, no shadow;
  label 14/600 ink
- Props: `bind:checked`, `label`, `disabled`, `onchange?(checked)`. On the space page the visible
  state is the one the panel below is about to confirm (`passwordOpen ? !hasPassword : hasPassword`)

### AI (`AiBadge.svelte`, `AnalyzeButton.svelte`)
- Everything AI is the `improve` family — the purple gradient is gone
- `AiBadge` = `badge-sm badge-ai` (improve tint) with an 11px star (stroke 2.5) + `analysis.badge`;
  `label="AI"` on the create screen
- `AnalyzeButton` variants: `header` → `btn btn-secondary btn-md` + 16px star `text-improve`
  (`compact` hides the label below `sm`); `menu` → `dropdown-item` in the board ⋯ menu;
  `retry` → `btn btn-secondary btn-sm` in the failed tile. All keep `data-testid="analyze-button"`
  (retry: `analyze-retry`)
- Frames: `border-2 border-improve` on the analysis tile and (from `md`) around the analysis
  board's columns; spinner `text-improve`; info toasts use the improve tint icon

### Bitrix24 (`BitrixPanel.svelte`, `BitrixTaskModal.svelte`, `TaskBadge.svelte`)
- Neutral family: the task badge never takes a column tone, accent or `improve`; `well` / `bad`
  only for success and error states; terracotta only on the one primary button of the panel
  («Connect») and of the modal («Create task»)
- **Trigger** (space page, creator row before «Password»): `btn btn-secondary btn-md pr-3.5`, link
  glyph 16 `text-text-secondary` (✓ 16 `text-well` once connected), label «Bitrix24», chevron 14
  muted rotated 180° when open, `aria-expanded`; `?bitrix=1` opens the panel with focus in the
  webhook field
- **`BitrixPanel`**: `collapsible` + `mt-7 rounded-2xl border border-border bg-surface-card p-4`.
  Not connected: labels 14/600, `input input-md` webhook `flex-1` (`type=url`) + group `w-[290px]`
  (`inputmode=numeric`), «Connect» `btn btn-primary btn-md` + «Cancel» `btn btn-secondary btn-md`,
  one-line hint 13 muted; Enter = Connect. Checking: 16px `animate-spin` spinner + «Checking…»,
  fields `opacity-50 pointer-events-none`. Connected: title 14/600 «Bitrix24 · {portal}» +
  `badge badge-outline` ✓ «Connected»; ink initial avatar 32 (13/700); «Tasks are created by:
  {name}» + a 13 note; default group «42 · Name» (muted «not set») with a pencil `btn-icon
  btn-icon-sm` → `input input-md w-32` + Save `btn btn-dark btn-md` + Cancel; «Disconnect»
  `btn btn-secondary btn-md hover:bg-bad-bg hover:text-bad` → `btn btn-danger btn-md` «Click again
  to disconnect» for 3s, no browser dialogs. Result badges `badge badge-success badge-pop` for 2.5s.
  Errors: field `border-bad` + `shake`, 13 `text-bad` under the row, the typed value stays;
  `last_error` → `error-box` above the reconnect form; no `ENCRYPTION_KEY` → an explanation
  instead of the form
- **`TaskBadge`** (`task`, `size`): an `<a target="_blank" rel="noopener">`; next to `AiBadge` it
  is the framed one. `md` (card, focused Summary row): `inline-flex h-8 items-center gap-1.5
  rounded-full border border-border bg-surface-card px-3 text-[13px] font-semibold
  text-text-primary`, external-link glyph 14 muted, «Task #123», hover `border-border-strong
  bg-surface-hover`, `active:scale-[0.97]`, `badgePop`, `title` = the task URL,
  `max-md:h-10 max-md:px-4`. `sm` (Summary row): `h-7 gap-1 px-2.5 text-text-secondary`, glyph 12,
  «#123», hover `border-border-strong text-text-primary`, `title` «Task #123 in Bitrix24».
  Rendered for everyone from `card.bitrixTaskUrl`, with or without a space
- **`BitrixTaskModal`** (mounted once in `Board.svelte`): the `NewBoardModal` recipe — overlay
  `fixed inset-0 z-[70] bg-scrim p-4` (transparent, no scrim, on phones), card `flex max-h-[calc(100dvh-2rem)]
  w-[480px] max-w-full flex-col rounded-3xl bg-surface-card shadow-2`, `role="dialog" aria-modal="true"`,
  focus trap, the title is focused and selected on open. Padding lives on each section, not on the
  card: header `shrink-0` (`px-6 pt-6 sm:px-8 sm:pt-8`) has the title Unbounded 21 + context 14
  secondary «{portal} · the retro tag is added automatically» and close `btn-icon btn-icon-lg
  btn-icon-bordered`; the fields section scrolls (`min-h-0 flex-1 overflow-y-auto gap-[18px] px-6
  py-[18px] sm:px-8`); the button row is `shrink-0` (`px-6 pb-6 sm:px-8 sm:pb-8`). Fields `input
  input-lg bg-surface` (title `maxlength=250`; group with a 13 status line `mt-1.5`: name muted /
  «not found» `text-bad`; date `type=date` with a 16px muted calendar glyph over a transparent native picker indicator); description `textarea bg-surface px-[18px] py-3
  text-[15px] leading-[1.5]`, grows 4–8 lines, then `max-h-[204px] overflow-y-auto`; «Important
  task» = `ToggleSwitch`; indicator lines 13 secondary with 14px glyphs, outside the Tab order.
  Buttons `btn btn-secondary btn-lg flex-1` + `btn btn-primary btn-lg flex-[2]`. Submitting: 16px
  spinner + «Creating…» («Creating and attaching the image…» with an image), form and close
  `opacity-50 pointer-events-none`, `aria-busy`, Escape and overlay ignored. Errors: `error-box`
  (`fadeUp`, `role="alert"`) above the buttons, «Space settings →» 700 `text-bad-strong
  underline`; retryable errors turn the primary button into «Retry»
- **Phone sheet** (below `sm`): `max-sm:fixed max-sm:inset-0 max-sm:h-[100dvh]
  max-sm:rounded-none`, no scrim, enters with `fly y:24`; the header and the button row stay
  `shrink-0` and gain a `border-border` divider (`max-sm:border-b` / `max-sm:border-t`) instead of
  scrolling away, fields scroll between them, so «Create task» stays visible above the keyboard
- Test ids: `bitrix-panel-toggle`, `bitrix-panel`, `menu-bitrix-connect`, `card-task-button`,
  `summary-task-button`, `bitrix-task-form`, `bitrix-task-submit`, `task-badge`

### Feedback
- **FAB**: `fixed right-5 bottom-5 z-[500] h-[38px] rounded-full bg-text-primary px-4 sm:px-[18px]
  text-sm font-semibold text-surface shadow-1`, 16px icon, label from `sm`; hover lift only
  (no hover shadow); on a board it sits at `bottom-24 md:bottom-5` above the mobile composer;
  hidden while the panel is open
- **Panel**: overlay `z-[600] bg-scrim backdrop-blur-sm` (fade 200ms); panel `z-[601]
  max-w-[400px] border-l border-border bg-surface-card shadow-2` (`fly x:400 350ms`); header
  `px-5 py-4 border-b` with Unbounded 21 title and close `btn-icon btn-icon-lg btn-icon-bordered`
  (`feedback.close`); labels 14/500 secondary, `input input-md`, `textarea px-3 py-2.5`,
  `error-box`, submit `btn btn-primary btn-md w-full`; success = 56px `accent-bg` circle + 17/700
  line + `btn btn-primary btn-md`; Escape closes

### Lightbox
- Backdrop `fixed inset-0 z-50 bg-scrim-strong backdrop-blur-sm` (`lightboxFadeIn`), click outside
  or Escape closes; close `btn-icon btn-icon-lg btn-icon-bordered` at `top-4 right-4`;
  image `max-h-[90vh] max-w-[90vw] rounded-2xl` (`lightboxZoomIn`)

### Space password form (`SpacePasswordForm.svelte`)
- `card card-lg max-w-sm` centred, no shadow; 48px `rounded-xl` bordered lock icon (turns `bad`
  on error); title Unbounded 21; `input input-lg`; error 13 `text-bad` + `shake`;
  submit `btn btn-dark btn-lg w-full`

## Animation System

| Animation | Duration | Easing | Usage |
|-----------|----------|--------|-------|
| cardEnter (`.card-enter`) | 0.55s | spring `(0.34, 1.56, 0.64, 1)` | Cards, dropdown menu, toasts, name card |
| tileEnter (`.tile-enter`) | 0.6s | spring | Board tiles in a space (first render only, 70ms stagger) |
| voteBounce | 0.3s | spring | Vote pill feedback |
| badgePop | 0.25s | spring | Comment counter, password success badge, TaskBadge, Bitrix24 panel badges |
| timerPulse | 0.7s ∞ | ease-in-out | Expired timer / focus timer |
| fadeUp | 0.25–0.8s | `(0.25, 1, 0.5, 1)` | Tab panels, move row, expanded card form, page headers |
| revealUp | 0.9s | `(0.16, 1, 0.3, 1)` | Landing scroll reveals |
| panelExpand (`.panel-enter`) | 0.3s | `(0.25, 1, 0.5, 1)` | Dropdown panels |
| collapsible | 0.25s | `(0.25, 1, 0.5, 1)` | Password and Bitrix24 panels, comments (grid-template-rows) |
| modalFadeIn / modalZoomIn | 0.2s / 0.3s | ease / spring | NewBoardModal and BitrixTaskModal overlay / card (the phone sheet flies in, y 24) |
| lightboxFadeIn / lightboxZoomIn | 0.25s / 0.35s | `(0.25, 1, 0.5, 1)` / spring | Lightbox |
| shake | 0.5s | ease | Wrong password, Bitrix24 webhook and group fields |
| feedback panel | fade 0.2s / fly 0.35s | cubic-out | Overlay / side panel |
| View Transition | 0.2–0.3s | `(0.25, 1, 0.5, 1)` | Page crossfade |

**Rules:**
- Respect `prefers-reduced-motion` (all durations → 0.01ms)
- Exit animations: 60–70% of enter duration
- Stagger list items: 50ms per card, 70ms per tile (delay capped at the 8th tile)
- No animation > 1s
- Only animate `transform` and `opacity` (no layout properties)

## Icon System

- Source: inline SVGs (no icon library, no emoji), `viewBox="0 0 24 24"`
- Stroke: `stroke-width="2"`, `stroke-linecap="round"`; 12px glyphs use `stroke-width="2.5"`
- Glyph sizes: 16 in 28/32/38px buttons (`h-4 w-4`) · 14 for the column sort, chevrons,
  FocusTimer clock, pill icons (`h-3.5 w-3.5`) · 12 for ✕ inside chips and toasts and the plus
  in the add-card circle · 11 for the `AiBadge` star · 18 for the «New board» plus and the mobile composer
- Color: `text-text-muted` at rest, `text-text-primary` on hover (`.btn-icon`); `text-improve`
  for the AI star; destructive hover `text-bad`
- All icon buttons must have `title` and `aria-label` attributes

## Z-index Scale

| Layer | Z-index | Usage |
|-------|---------|-------|
| FocusTimer tooltip | 30 | Maxim under the focus timer chip |
| Mobile composer, toasts | 40 | Bottom bar on phones; the notification stack sits under the header so an open ⋯ menu is never covered |
| Header, dropdown menu, lightbox | 50 | Sticky navigation, board ⋯ menu, image viewer |
| Modal | 70 | NewBoardModal and BitrixTaskModal overlays |
| FAB | 500 | Feedback floating button |
| Overlay | 600 | Feedback panel backdrop |
| Panel | 601 | Feedback slide-out |

## Accessibility

- Contrast: 4.5:1 minimum for body text, 3:1 for large text
- All icon buttons: `aria-label` + `title` tooltip; toggles use `aria-pressed` / `aria-expanded`
- Focus rings: visible on all interactive elements (browser default)
- Keyboard: Tab order matches visual order; Escape closes the modal, panel and lightbox
- Toasts: `role="status"` (`role="alert"` for errors)
- Color alone never conveys meaning (dots + column titles + badges)
- `prefers-reduced-motion`: all animations disabled, focus scroll becomes instant

## i18n

- All user-facing strings through `t('key')`
- Both `en.json` and `ru.json` must have every key (the dictionary test enforces parity)
- Mockup/placeholder text on the landing page must also be localized
- Dates: relative format or ISO (not locale-dependent formatting)

## UX & Navigation

### Page Transitions
- All page changes use the View Transitions API (`onNavigate` in the layout)
- Old page: `fadeOut 0.2s`, new page: `fadeIn 0.3s`
- On back/forward: data revalidated via `invalidateAll()` on `popstate`

### Navigation Flow
```
Landing (/)
  ├─→ /new → Create Board → /[slug] (board)
  ├─→ /new → Create Space → /spaces/[slug] (space)
  ├─→ /formats, /how-to-run-a-retro, /changelog, /api
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
2. **Breadcrumbs show context** on the board — `/` → Space → Board; the space page names itself once, in the H1
3. **Back button works** — data refreshed on popstate, scroll restored
4. **No dead ends** — every page has a clear path back
5. **Feedback accessible everywhere** — header link on site pages + FAB on all pages
6. **No page reload on actions** — toasts/panels instead of navigation

### Interaction States
Every interactive element must have:
- **Default** → visible, clear affordance
- **Hover** → `bg-surface-hover` or a stronger border (`border-border-strong`), `transition-colors 0.2s`
- **Active/Press** → `active:scale-[0.97]` (buttons) or `active:scale-95`
- **Focus** → browser default focus ring (do not remove)
- **Selected** → a 2px frame in the meaning color (`border-accent` + inset shadow of the same
  color, or `border-2 border-accent` for the focused summary row) — never a glow
- **Disabled** → `opacity-50`, `pointer-events-none`

### Scroll Behavior
- Landing page: IntersectionObserver reveals sections (blur+scale entrance)
- Board page: no scroll animations (content is interactive, not promotional); the focused summary
  row scrolls itself into view
- Lists/grids: stagger entrance (50ms per card, 70ms per tile)
- Smooth scroll to anchor links (`scroll-behavior: smooth` on html)

### Feedback Patterns
| User Action | Feedback |
|-------------|----------|
| Create board/space | Redirect + success toast top-right «Created — share the link» with «Copy link →» (15s) |
| Copy link | Button / toast action label → «Copied!» for 2s |
| Vote on card | Bounce animation + instant count update |
| Submit feedback | Panel shows checkmark + "Thanks!" |
| Delete (destructive) | Inline confirmation first (card ✕ turns red for 3s; menu/space confirm row) |
| Error | 13px `text-bad` text near the field, `shake`; error toast for background jobs |
| Loading | Spinner on the button, button disabled; pending tile with an improve spinner |
| Background job done | Info/success toast with an «Open →» link — on any page |
| Create a Bitrix24 task | Spinner + «Creating…» on the button, modal locked; success closes it, the badge pops for everyone, success toast «Task #N created» with «Open →» in a new tab |

### Mobile UX
- Header collapses to essentials (brand square or title, timer, share square, menu)
- Columns become segment tabs; composer pinned to the bottom (48px controls)
- FAB: icon-only (no text label)
- Touch targets: pills 40px, tabs ≥ 44px, composer 48px
- No hover-dependent interactions (the FocusTimer tooltip pins on tap)

## Utility Classes

Reusable CSS classes defined in `src/app.css` (`@layer components`). Composable — combine
base + size + variant. Override any property with inline Tailwind.

### Buttons

| Class | Purpose |
|-------|---------|
| `.btn` | Base: inline-flex, centred, gap-2, font-semibold, transition-colors, disabled = opacity-50 + no pointer events |
| `.btn-sm` | 32px: `h-8 rounded-xl px-3 text-[13px]` — inside cards and summary rows |
| `.btn-md` | 38px: `h-[38px] rounded-xl px-4 text-sm` — header, toolbars, inline forms |
| `.btn-lg` | 54px: `h-[54px] rounded-xl px-[26px] text-base` — creation forms, modal |
| `.btn-primary` | Accent (terracotta) bg, white bold text — the one primary action |
| `.btn-dark` | Ink bg, surface text — Share, Save name, comment Send, password form |
| `.btn-danger` | `bad` bg, white text |
| `.btn-secondary` | Border, surface-card bg, ink text, hover bg — sort, analysis, cancel, back |
| `.btn-ghost` | No bg/border, secondary text, hover bg |

**Icon buttons** (borderless and muted until hovered):

| Class | Purpose |
|-------|---------|
| `.btn-icon` | Base: flex centre, `rounded-lg` (8), `text-text-muted`, hover `bg-surface-hover text-text-primary` |
| `.btn-icon-sm` | 28px (`h-7 w-7`) — glyph 16 (sort glyph 14): card actions, pencils, attach, stop, close in chips/toasts |
| `.btn-icon-md` | 32px (`h-8 w-8`) |
| `.btn-icon-lg` | 38px (`h-[38px] w-[38px] rounded-xl`) — header-row icon buttons, modal/panel close |
| `.btn-icon-bordered` | Adds `border border-border bg-surface-card text-text-secondary` — GitHub, EN, Theme, delete space, close buttons |

**Example:** `<button class="btn btn-primary btn-md w-full">Submit</button>`

### Inputs

| Class | Purpose |
|-------|---------|
| `.input` | Base: full-width, `rounded-xl` (12), border, surface-card bg, text-sm; focus = ink border + 0.5px inset ring |
| `.input-sm` | 32px: `h-8 px-2.5 text-[13px]` — comment form, inline rename, header name |
| `.input-md` | 38px: `h-[38px] px-3 text-sm` — name card, search, password panel, join row, feedback |
| `.input-lg` | 54px: `h-[54px] px-[18px] text-base` — create screen, modal, password form |
| `.textarea` | Same as input + `resize-none`, 15px text — card edit, feedback message |

**Example:** `<input class="input input-lg" placeholder="Title" />`

### Pills (votes, comments — always visible)

| Class | Purpose |
|-------|---------|
| `.pill` | Base: `inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold` (32px) |
| `.pill-outline` | 1px border, muted text — inactive vote |
| `.pill-well` | Green tint fill — active like |
| `.pill-bad` | Red tint fill — active dislike |
| `.pill-neutral` | `bg-surface-hover text-text-primary font-semibold` — comment counter (state, not action) |

### Cards

| Class | Purpose |
|-------|---------|
| `.card` | Base: `rounded-2xl border border-border bg-surface-card` |
| `.card-interactive` | Hover lift + `border-border-strong` (no shadow) |
| `.card-sm` / `.card-md` / `.card-lg` | Padding p-4 / p-5 / p-6 |
| `.card-board` | Board card: `rounded-2xl border border-border bg-surface-card p-4` — no shadow |
| `.dropdown` | Menu container: `rounded-2xl border bg-surface-card py-1 shadow-1` |
| `.dropdown-item` | Menu item: flex, gap-2.5, `px-3 py-2 text-[13px]`, hover bg |

### Badges

| Class | Purpose |
|-------|---------|
| `.badge` | 28px pill: `inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold` |
| `.badge-sm` | 20px tag: `h-5 rounded-lg px-[7px] text-[11px] font-bold uppercase tracking-[0.04em]` — column labels, «Recommended», AI, focused score |
| `.badge-outline` | `border border-border bg-surface-card text-text-secondary` — space lock badge |
| `.badge-accent` | Accent tint bg + accent text |
| `.badge-success` | Green tint bg + `well-strong` text |
| `.badge-ai` | `bg-improve-bg text-improve-strong` — flat, no gradient (used by `AiBadge.svelte`) |
| `.badge-version` | `rounded-lg` ink bg, surface text — latest changelog release |
| `.badge-version-outline` | `rounded-lg` bordered — older changelog releases |

### Errors

| Class | Purpose |
|-------|---------|
| `.error-box` | `rounded-lg bg-bad-bg text-bad-strong`, text-sm, icon gap |
| `.error-box-sm` | Smaller padding + `text-[13px]` |

### Tooltips

| Class | Purpose |
|-------|---------|
| `.icon-tip` | Icon-button tooltip (FocusTimer idiom): `rounded-xl bg-text-primary px-3 py-2 text-[13px] text-surface shadow-1`, 150ms on hover / `:focus-visible` — the card icons |

### Format art

| Class | Purpose |
|-------|---------|
| `.format-art` | Illustrated format tile: `rounded-2xl border border-border bg-art-canvas`, picture from `style:background-image` fitted to the tile height at the right |
| `.format-art-row` | Compact `FormatPicker` row (modal): the picture always 48px high at the right, whatever the row height |
| `.format-art-stack` | Below `md`: the picture as a full-width 3:1 band under the text (`FormatTile`) |
| `.format-art-foot` | Below `sm`: the picture 72px high in the bottom-right corner, 80px bottom padding (full `FormatPicker` on `/new`) |

### Shared components that wrap these classes
`AiBadge.svelte` (`badge-sm badge-ai` + star), `AnalyzeButton.svelte` (header / menu / retry),
`ToggleSwitch.svelte` (38px labelled frame), `Toasts.svelte` + `toastStore`, `NamePrompt.svelte`,
`TaskBadge.svelte` (bordered link pill, `md` 32 / `sm` 28).

## Anti-patterns (DO NOT)

- **Gradients** — the purple AI gradient was the last one; AI is a flat improve tint (`badge-ai`)
- **Glows and grey shadow scales** — no `shadow-sm/md/lg/xl/2xl`, no colored `shadow-[…rgba(196,85,43,…)]`,
  no shadow on cards or tiles (level 0 = border), no glow on selected / focused elements
- **Opacity tints of tokens and raw colors** — `text-text-primary/85`, `bg-surface-card/50`,
  `black/30`, `white`, `red-500`, hex in markup; use tokens, `bg-scrim` for overlays, `text-bad` for errors
  (only exception: `text-white` / the toggle's `bg-white` knob on a saturated fill — rule 4)
- **Off-scale values** — `rounded-sm/md`, `rounded-[10|14|18|20px]`; 36 or 40px controls in a 38px
  row; font sizes 10, 12, 13.5, 19, 20, 22, 24, 30, 34 (`text-xs`, `text-lg`, `text-xl`) in the
  shared components and the board / space / create screens
- **Terracotta for state** — comment counters, the fourth column, AI: accent means action, timer, active nav
- **Hover-reveal actions** — every card action (votes, comments, edit, move, delete) is always visible
- Hiding primary actions in overflow menus (Share is a visible button)
- Bottom banners or stacked banners — one toast stack, top-right, with an action
- Copying admin links in public-facing toasts (strip `?admin` first)
- Naming the space twice (header + H1) or two pencils for one title
- Green or coloured avatars, "?" as an avatar — avatars are ink, unnamed = grey user icon
- Icon-only controls without labels (the password switch carries the word «Password»)
- Different header layouts on different pages
- Placeholder-only form labels
- Hardcoded English text in mockups when UI is in Russian
