# Handoff: Vetree UI Redesign ("Almanac")

A full visual redesign of Vetree — the veterinary evidence platform — covering the marketing landing page, the core article feed (3 views), article detail, library, onboarding, mobile, and the admin analytics dashboard.

## About the Design Files

The files in `designs/` are **design references created in HTML**. They are prototypes showing the intended look and behavior — **not production code to copy directly**. The task is to **recreate these designs inside the existing Vetree codebase** (Next.js App Router + Tailwind CSS + Supabase + recharts) using its established patterns, components, and data layer.

Each `.dc.html` file opens directly in a browser. `support.js` and `ios-frame.jsx` are prototype runtime files — ignore them for implementation; they are only needed to open the prototypes.

The `screenshots/` folder shows every screen rendered. **Treat screenshots as the source of truth for look; treat the HTML source as the source of truth for exact values** (all styles are inline, so any value can be read straight off an element).

## Fidelity

**High-fidelity.** Colors, typography, spacing, radii, copy, and interactions are final. Recreate pixel-perfectly, but with the codebase's stack: Tailwind utilities (extend the theme with the tokens below), existing routing, existing data fetching. This is a **reskin, not a rebuild** — all existing functionality (search, filters, sort, save, auth, AI disclaimer, admin data) is retained; only its presentation changes.

## Design Language Summary

- **Mood**: dark, warm, editorial — "a naturalist's field journal." Paper-toned off-whites on near-black warm browns, one green accent.
- **Type**: `Spectral` (serif) for headlines, article titles, bottom lines, and italic bylines/asides; `Instrument Sans` for all UI chrome (buttons, chips, labels, tables, metadata). Both from Google Fonts. No other fonts.
- **The clinical bottom line is the hero** everywhere — it leads cards, feed rows, and the article page.
- Chips/pills are `border-radius: 999px`, tinted with the tag's hue at ~10% background + ~25–40% border opacity.
- Cards: `#1B1811` bg, 1px border `rgba(232,224,204,.09)`, radius 13–16px (small) / 16–22px (large). No shadows except overlays/phone mock.
- **AI disclaimer** (amber-tinted panel) must remain on article detail; italic one-liner on mobile detail.

## Design Tokens

Implement as CSS custom properties (or Tailwind theme entries). The prototypes theme via `--*` vars with Dark as default; Light mode overrides the same vars.

### Dark (default)

| Token | Value | Use |
|---|---|---|
| bg | `#14120E` | page background |
| card | `#1B1811` | cards, inputs |
| card2 | `#16130E` | sidebars, wells |
| accent | `#8FCB5E` | **locked** — links, active states, primary buttons |
| on-accent | `#14120E` | text on accent |
| ink1 | `#F2ECDD` | largest headlines |
| ink2 | `#EFE9DA` | headlines, emphasized values |
| ink3 | `#E8E0CC` | primary body/UI text |
| ink4 | `#DCD3BE` | article titles in lists |
| body | `#C4BCAA` | long-form paragraphs |
| sub | `#B4AD9A` | secondary UI text |
| mut1 | `#A7A08E` | summaries |
| mut2 | `#9A9280` | bylines |
| mut3 | `#8F877A` | italic asides |
| mut4 | `#8A8272` | labels, icons |
| mut6 | `#6F695B` | faint metadata, placeholders |
| mut7 | `#5F5A4E` | separator dots |
| line (rgb) | `232,224,204` | borders at .06–.18 alpha; hairlines `rgba(232,224,204,.08)` |
| bar (rgb) | `20,18,14` | sticky app bar at `.86` + `backdrop-filter: blur(14px)` |

### Light

| Token | Value |
|---|---|
| bg `#F7F3E8` · card `#FFFFFF` · card2 `#FCF8ED` · accent `#5F8C33` · on-accent `#FFFFFF` |
| ink1 `#1F1A0E` · ink2 `#262013` · ink3 `#332C1B` · ink4 `#3D3524` · body `#514935` · sub `#5F5745` |
| mut1 `#6B634E` · mut2 `#756D57` · mut3 `#7E7663` · mut4 `#837B66` · mut6 `#9C947D` · mut7 `#B3AB93` |
| line (rgb) `62,54,36` · bar (rgb) `247,243,232` |

**Light-mode chip colors**: the specialty/evidence hues below are calibrated for dark. In light mode, darken each chip's text color by mixing 52% of the hue with `#241B0C` (prototypes use `color-mix(in oklab, <hue> 52%, #241B0C)`). Backgrounds/borders keep the raw hue at the same low alphas.

### Specialty / label hues

Cardiology `#E88A92` · Emergency `#E88AA0` · Internal Medicine `#7FB0EC` · Equine `#5FCDB8` · Oncology `#C79CE8` · Ophthalmology `#7FB0EC` · Anesthesia `#B49AE8` · Orthopedics `#E8A968` · Dermatology `#E0CC6A` · Neurology `#9AA6E8` · Small Animal `#8FD65E` · Large Animal `#E0BC5E` · Exotic `#5FC7D8` · Radiology `#6FBFEC` · Pathology `#E88AD8` · Pharmacology `#BFD65E` · Nutrition `#5FD69A` · Behavior `#A6B0C0` · Reproduction `#E893C0` · Soft Tissue Surgery `#E893C0` · Dentistry `#B8B0A0`

Chip recipe: `background: <hue> @ 10%`, `border: 1px solid <hue> @ 30%`, `color: <hue>` (dark) / mixed (light), `padding: 5px 11px`, `radius: 999px`, `font: 500 11.5px Instrument Sans`.

### Evidence tiers

| Tier | Label | Chip hue | Dot |
|---|---|---|---|
| Gold | RCT / Meta-analysis | `#A9E07C` | `#8FD65E` |
| Silver | Cohort / Prospective | `#8FBEEC` | `#6FA8E8` |
| Bronze | Case series / Retrospective | `#E8B060` | `#E0A040` |

Tier chip = pill with 6px colored dot + label.

### Type scale (dark & light identical)

- Page titles: Spectral 500, 28–30px, line-height 1.1, letter-spacing −.01em
- Landing hero: Spectral 500, 60px/1.04, −.02em
- Bottom line (feed stream): Spectral 500, 25px/1.42
- Article/list titles: Spectral 600, 21px/1.3
- Italic asides/bylines: Spectral italic 400, 12–15px
- UI/buttons: Instrument Sans 600, 13–14px
- Section kickers: Instrument Sans 600, 10–11px, letter-spacing .12–.15em, uppercase
- Body/summaries: Instrument Sans 400, 14–16.5px, line-height 1.6–1.75

### Other

- Radii: 999px pills · 8–11px buttons/inputs · 13–16px cards · 18–22px large panels
- Logo: existing leaf SVG path (`M17,8C8,10…`), filled with accent, next to "Vetree" in Spectral 600 18–21px
- Selection color: accent bg, on-accent text
- Emoji: only country flags in admin (existing behavior). No other emoji anywhere — the old sidebar emoji icons are replaced (see Admin).

## Screens / Views

Full markup for every screen is in `designs/` — open the file and read the inline styles for any measurement not listed here.

### 1. Landing — `Vetree - Landing.dc.html` → `app/page.tsx` (logged-out)
Marketing page. Nav (logo, How it works / Evidence / For teams, Sign in, accent "Create free account" button) → hero (60px serif headline with italic accent word "distilled.", "23,000+" claim, CTAs, floating article-card mock) → stats row (23,000+ articles · 19 specialties · ~40s) → three "how it works" steps → evidence-tier explainer cards with fill bars (Gold 96% / Silver 64% / Bronze 36%) → specialty chip cloud → final CTA panel. All copy is final in the file.

### 2. Feed — `Vetree - Core.dc.html` → home feed for logged-in users
The core screen. Sticky app bar: logo · center view-switcher (segmented control: **Stream / Grove / List**) · search (collapsed icon → expands to 306px input, filters as you type, shows "N results for 'q'") · Library link · avatar. Filter pill row below bar (hidden in Grove view): Latest / Small Animal / Cardiology / Emergency + "Evidence ▾" and "Journal ▾" dropdowns.

- **Stream** (default, 704px column): "The bottom line" serif h1; hairline-separated rows, each: specialty + tier chips → the **bottom line as a 25px serif headline** → "PAPER <title>" row → italic byline · "Expand summary ›" toggle (inline card with summary + "Read full article") · share · bookmark.
- **Grove**: full-width panel (540px tall). Left: SVG map — central accent circle ("Your grove") with curved branches (quadratic, bend 26px) to 6 specialty nodes sized by new-article count; selected node enlarges with glow. Right: 360px panel listing that specialty's bottom lines. Footnote: "Bigger nodes = more new evidence".
- **List** (844px column): full-metadata cards — journal + date row, actions, 21px serif title, authors, accent-left-border "Clinical bottom line" pull-quote, tier chip, summary paragraph, footer with label chips + "Read full article →". Header shows total "23,412 articles".

State: view, filter, per-article expanded/bookmarked, search open/query. Bookmark toggles fill with accent.

### 3. Article detail — `Vetree - Article.dc.html` → `app/article/[id]`
App bar variant: "‹ Stream" back link | logo · Save (toggles to accent-filled "Saved") · share · avatar. Two columns (main + 300px sticky rail). Main: chips row (specialty, tier, "4 min read · distilled by Vetree AI") → serif h1 → authors/journal/date → **bottom-line hero panel** (accent-tinted gradient card, lightning icon, 22px serif) → Summary (3 paragraphs, 16.5px/1.75) → Key findings card (bulleted) → label chips → **AI disclaimer** (amber `#E0A040`-tinted panel — keep verbatim: "This summary was distilled by AI and may occasionally misinterpret data. Confirm critical details with the original paper before acting on it."). Rail: accent "Read full article ↗" button → Citation card (journal, published, DOI in accent) → evidence-tier explainer card → Related articles card.

### 4. Library — `Vetree - Library.dc.html` → `app/library`
Same app bar as Article (+ dedicated "Search your library…" input). Header: "DR. KRIS · PERSONAL SHELF" kicker, "My Library" serif h1, stat block (142 Saved · 5 Collections · 4/5 To read). Underlined tab nav with count badges: **Saved / Collections / Reading list**. Saved: specialty filter pills + 2-col card grid (chip row, serif bottom line, byline footer, bookmark). Collections: named cards with color-dot stacks, counts, updated dates. Reading list: checkable rows with read-time; done items strike through.

### 5. Onboarding — `Vetree - Onboarding.dc.html` → `app/signup` + `components/onboarding`
Split layout: 320px left rail (logo, 4-step progress list — numbered circles, accent = current, quote at bottom) + main panel. Steps: 1 Account (Google button, or email + password) → 2 About you (role radio cards, focus multi-chips) → 3 Your grove (specialty multi-select chip grid with live count) → 4 Ready (summary of selections, "Enter Vetree" accent button). Footer: Back + Continue ("Create account" label on step 1).

### 6. Mobile — `Vetree - Mobile.dc.html` → responsive behavior of feed + article
Two 390×844 screens. **Feed**: compact bar (logo + avatar), full-width search field, horizontally scrolling filter pills, stacked cards (chip row → accent-left-border bottom line, italic serif → title + byline), bottom tab bar (Stream / Grove / Library / Profile, accent active). **Article detail**: back/share/save icon bar, chips, serif title, byline, bottom-line panel, summary, key findings, italic one-line AI disclaimer, sticky bottom "Read full article" accent button. Hit targets ≥ 44px.

### 7. Admin — `Vetree - Admin.dc.html` → `app/admin/*`
Reskin only — **identical information architecture** to the current admin. Sidebar (236px, card2 bg): logo + "ADMIN DASHBOARD" kicker, the 8 existing nav items (Overview, Analytics, Reports, Users, Pipeline, Security, Growth OS, Campaign) as text items with 5px dot indicators (**emoji icons removed**), active = accent text on accent-10% pill; footer "← Back to app". Keep the existing collapse behavior if desired — not shown in the mock.

Analytics page: serif "Analytics" h1 + italic subtitle · segmented date-range control (7/30/90, refetches like today) · 3×2 stat-card grid (Total pageviews, Unique visitors, Logged in %, Anonymous %, Saved articles, Synthesis runs) — 27px Spectral values, uppercase Instrument Sans labels · Visitors-over-time line chart (accent total-views line + area fill @ 8%, `#8FBEEC` unique line) · Top pages horizontal bars · Top articles table · Session duration (big serif avg/median) + duration distribution as **horizontal bars** (`#E8B060`/`#8FBEEC`/accent/`#C79CE8`) · Device breakdown as stacked segment bar + legend · Top countries list (flag emoji stays) · Traffic sources bars + table (signups column in accent) · Recent searches sortable table (sortable headers: active column accent with ▲/▼, queries in italic serif quotes).

**recharts**: keep it. Restyle: grid `rgba(232,224,204,.07)`, axes `#8A8272` 11px Instrument Sans, line colors accent/`#8FBEEC`, bar fill accent, tooltip bg `#1B1811` border `rgba(232,224,204,.12)` radius 8px. **Replace the two pie charts** with the distribution-bar / stacked-segment treatments above (recharts not needed for those — plain divs).

## Interactions & Behavior

- Hover: text links → ink3 or accent; card borders → `rgba(232,224,204,.2)` or accent; buttons `filter: brightness(1.08)`. Transitions ~150ms ease.
- Sticky app bar: `rgba(20,18,14,.86)` + `backdrop-filter: blur(14px)`, 1px bottom hairline.
- Search: icon button ⇄ expanded input (accent border when open), Esc/✕ closes and clears.
- Bookmark: outline `#8A8272` → filled accent. Persist via existing saved-articles API.
- Expand summary (stream): inline card, label toggles "Expand summary ›" / "Hide summary".
- Navigation: logo → feed; "Read full article" (feed) → article detail; "Library" → library; landing CTAs → signup; onboarding finish → feed; admin "Back to app" → feed.
- Loading/error/empty states: reuse existing logic, restyle to tokens (empty states: centered mut3 italic Spectral).

## Implementation Order (suggested phases)

1. **Tokens + fonts** — add Spectral & Instrument Sans (`next/font`), define the token tables as CSS vars/Tailwind theme, wire Dark/Light to the existing theme mechanism. Accent locked `#8FCB5E` (dark) / `#5F8C33` (light).
2. **Feed: Stream + List views** — the core screen; build the app bar, view switcher, pills, and both row/card treatments against real data.
3. **Article detail** — bottom-line hero, rail, disclaimer.
4. **Library** — tabs, saved grid, collections, reading list.
5. **Onboarding / signup** — 4-step flow.
6. **Landing** — marketing page.
7. **Grove view** — the SVG specialty map (most novel; ship behind a flag if useful).
8. **Admin reskin** — sidebar + analytics restyle, recharts theming.
9. **Mobile + light-mode QA** — responsive pass per the mobile mock, verify light tokens everywhere.

Each phase is independently shippable; verify against the matching screenshot before moving on.

## Working with this package in Claude Code

- Point Claude Code at this folder and implement **one phase at a time**; per phase, have it read this README **and** the relevant `designs/*.dc.html` file (exact values live in the inline styles), then compare output against `screenshots/`.
- The prototype files contain some prototype-only scaffolding (`<x-dc>`, `sc-for`/`sc-if` tags, `{{ }}` holes, a logic class in a script tag). Markup structure and inline styles translate directly; control flow becomes normal React.
- Don't let it import `support.js` / `ios-frame.jsx` or copy the HTML files into the app.

## Assets

- Logo: inline SVG leaf path already in the codebase (`AdminSidebar.tsx` uses the same path) — no new asset.
- Fonts: Google Fonts (Spectral 400/500/600/700 + italics; Instrument Sans 400/500/600) — self-host via `next/font`.
- No raster images. Country flags are emoji (existing behavior).

## Files

| File | Screen |
|---|---|
| `designs/Vetree - Landing.dc.html` | Marketing landing |
| `designs/Vetree - Core.dc.html` | Feed — Stream / Grove / List |
| `designs/Vetree - Article.dc.html` | Article detail |
| `designs/Vetree - Library.dc.html` | My Library |
| `designs/Vetree - Onboarding.dc.html` | Sign-up flow |
| `designs/Vetree - Mobile.dc.html` | Mobile feed + detail |
| `designs/Vetree - Admin.dc.html` | Admin analytics |
| `designs/support.js`, `designs/ios-frame.jsx` | Prototype runtime — reference only |
| `screenshots/*.png` | Rendered reference for every screen/view/step |
