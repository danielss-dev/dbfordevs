# UI/UX Improvement Plan — "Instrument Panel"

Design direction for making dbfordevs the best-looking multi-database viewer, borrowing the
craft of **strand** (`../strand`) while keeping dbfordevs' own identity.

## What strand does right (and what we adopt)

strand's UI reads as premium because of a handful of consistent decisions, not one big effect:

| strand pattern | What it looks like | Adoption in dbfordevs |
|---|---|---|
| Hairline borders | `box-shadow: 0 0 0 0.5px var(--border) inset` instead of 1px borders | Elevated surfaces (menus, dialogs) get hairline rings |
| Layered elevation | Surfaces step up by lightness + a tokenized shadow scale | New `--shadow-*` tokens, warm-tinted on light themes |
| Accent-glow focus | `0 0 0 1.5px accent inset, 0 0 0 3px accent-glow` on every focusable | One canonical focus recipe on all primitives |
| Accent underline | Active tab = short accent bar grown under the label | Query tabs, activity bar |
| Tracked micro-labels | 10px, uppercase, `letter-spacing: 0.08em` for section/group headers | Menu labels, grid headers, panel sections |
| House motion | 120–200ms, `cubic-bezier(0.2, 0.7, 0.4, 1)`, real enter+exit | Tokenized easing + pop-in keyframes |
| Restraint | No glassmorphism, no colored mega-shadows; flat warm surfaces | Remove colored drop-shadows from buttons |

Identity kept: dbfordevs stays **orange (hue 24), mono-first, dense** — that's its brand. We are
not porting strand's amber or its OKLCH palette; we port the *system*.

## Findings from the audit

1. **`tailwindcss-animate` is not installed.** Dialog/dropdown/select/popover/tooltip all carry
   `animate-in fade-in-0 zoom-in-95 data-[state=...]` classes — every one of them is dead. No
   overlay in the app animates today. Installing the plugin instantly enables enter/exit motion
   app-wide.
2. **Focus rings are inconsistent**: Button uses offset rings, Input uses inset rings, tab close /
   sidebar actions / grid headers have none. Keyboard navigation is visually broken in places.
3. **Colored mega-shadows** (`shadow-md shadow-primary/20`) on primary/destructive buttons read as
   2019-era Dribbble; strand uses flat fills with a 1px inset highlight instead.
4. **Blanket `* { transition: ... }`** on every element (150ms) — janky and uncontrolled.
5. **Hardcoded palette colors** — 267 occurrences across 40 files (`text-yellow-500`,
   `bg-blue-500/10`, …) bypass the theme system and break Nordic/Solarized/High-Contrast.
6. **Two badge systems** (CVA `Badge` + `.badge-*` CSS classes) and two status-dot systems coexist.
7. **`success/warning/info` tokens have no `-foreground` pair** and aren't fully mapped in
   Tailwind, forcing verbose `bg-[hsl(var(--success)/0.15)]` arbitrary values everywhere.
8. Tooltips are loud (orange `bg-primary`); popover surfaces are default-shadcn flat `shadow-md`.

## Applied in this pass

### Foundation
- [x] Install + register `tailwindcss-animate` — brings all Radix enter/exit animations to life.
- [x] `index.css`: new shared tokens (inherited by all 10 themes via `:root`, dark override via `.dark`):
  - `--shadow-1/2/3/pop` — tokenized shadow scale; warm-tinted on light, deeper on dark.
  - `--accent-glow: hsl(var(--ring) / 0.22)` — the focus-glow color, derived from each theme's ring.
  - `--ease-swift: cubic-bezier(0.2, 0.7, 0.4, 1)` + `--ease-exit` — the house easing.
  - `--success-foreground`, `--warning-foreground`, `--info-foreground`.
- [x] Scoped-down global transition (120ms, house easing, colors only) + `prefers-reduced-motion` support.
- [x] Global `kbd` styling (mono, 10px, elevated chip) — shortcut hints now look intentional anywhere.
- [x] `.micro-label` utility — tracked-uppercase section label recipe.
- [x] Tailwind: `success/warning/info` get full `DEFAULT`/`foreground` + `shadow-pop`, `ease-swift`,
  `animate-pop-in` mappings; `font-sans` fixed to Inter (was mono — `.style-developer` still forces mono).

### Primitives (`src/components/ui/`)
- [x] **Button** — flat fills with subtle inset top-highlight instead of colored drop-shadows; one
  canonical accent-glow focus ring; `success` variant uses tokens.
- [x] **Input** — matching focus recipe (accent hairline + glow), no more ring-offset drift.
- [x] **Dialog** — tokenized `shadow-pop`, tighter overlay blur, 150ms swift motion.
- [x] **Tooltip** — quiet elevated surface (popover colors + hairline + shadow) instead of orange.
- [x] **Dropdown / Context menu / Select / Popover** — shared elevated recipe: `rounded-lg`,
  hairline border, `shadow-pop`, swift pop-in; labels become tracked micro-labels; shortcuts mono.

### Shell (`src/components/layout/`)
- [x] **Query tab bar** — active tab gets the strand-style accent underline (animated grow),
  close button gains a focus-visible state.
- [x] **Right activity bar** — active tool gets a growing left accent bar + tinted tile
  (replaces the odd outer-edge `border-r-2`).
- [x] **Status bar** — flat surface, tabular numerals everywhere, tokenized status pills.

### Data grid
- [x] Column headers become tracked micro-labels (the single biggest "pro tool" signal in a DB app).
- [x] Pinned-column shadows tokenized (were hardcoded black rgba, invisible on light themes).

## Applied in pass 2 (branch `ui-improvments`)

- [x] **Hardcoded color sweep** — 463 raw-palette occurrences audited across 68 files; ~340
  migrated to semantic tokens (`success`/`warning`/`destructive`/`info`/`primary`/`muted`), all
  redundant `dark:` twins removed. The ~120 that remain are deliberate: categorical type hues
  (Redis data types, BSON/CQL value types, schema-object kinds, data-type icons), DB brand colors
  (Redis red, Mongo green, Oracle red), yellow favorite stars, fixed dark code panels, and
  theme-editor swatches — those should not follow the theme.
- [x] **AI accent unification** — the violet/purple "AI branding" scattered across `ai/`,
  `bookmarks/`, `settings/`, `SidePanel`, and the Mongo/Redis AI helpers now uses the theme's
  `primary` accent, so the AI surfaces re-theme with everything else.
- [x] **Command palette upgraded** (it already existed at Ctrl+K) — strand recipe: 640px elevated
  surface, hairline border + `shadow-pop`, pop-in motion, blur backdrop, tracked-uppercase group
  headings, global kbd chips, accent-tinted icon on the selected row, quiet footer hints.
- [x] **Badge/status-dot unification** — legacy `.badge-*` CSS classes deleted; `Badge` CVA
  variants and `row-count-badge`/`execution-time-badge` now use clean token utilities.

## Roadmap (next passes)

1. **Density setting** — strand-style compact/default/relaxed row heights (`--row-h`) for the
   sidebar tree and data grid.
2. **Per-connection accent** — strand re-themes per repo; dbfordevs could tint the accent per
   connection (prod = red, staging = amber…), a killer safety feature for a DB tool. Needs an
   `accentColor` field on the connection config (Rust struct + TS type + modal UI).
3. **Empty-state upgrade** — welcome screen with recent connections (strand shows recents, not a blank pane).
4. **Decompose `Sidebar.tsx` (130KB) / `SidePanel.tsx` (75KB)** before deeper visual work there.
5. **Contrast audit** of muted-on-muted text (`text-muted-foreground/60` on `bg-muted/30`).
