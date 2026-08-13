# ShipGraph design system

Surface mode: **Operate**. People come to scan, compare, and understand a living graph.
The design exists to make real data legible fast — expression yields to structure, and
brand lives in precise details.

## World

Light content on warm paper (`--bg #f6f4f0`), a dark ink header bar as the frame of the
app shell, and one ember accent (`#E04F2F`) reserved for *action, shipping, and the
flag moment*. The accent is never decoration: it marks what was shipped, what is clickable,
and the source of truth. Tones of warning/ok/maintenance speak only in their own domains
(incidents, status).

The mark is a three-node graph glyph — the product's shape in its own logo. The dark
header carries a faint white ring `inset 0 -2px 0 var(--accent)` on the active nav item:
"you are here, on the graph".

## Type

- **Sans:** Inter (self-hosted via `next/font`, `--font-inter`), weights 550/650/750/800.
- **Mono:** system monospace stack (`--font-mono`), used only for *data*: logins, keys,
  tags, SHAs, Cypher, repo names in code contexts. Never as costume.
- Display sizes: hero `clamp(38px, 6vw, 56px)` weight 800, tracking `-0.03em`,
  `text-wrap: balance`. Page titles 28–38px, weight 800, tracking `-0.025em`.
  Section titles 21px, weight 750. Body 16px/1.55, sub-copy 13–14.5px `--ink-2`/`--muted`.
- Numbers render `font-variant-numeric: tabular-nums` everywhere they can be compared.
- Measure: hero sub ≤56ch, page subs ≤62ch.

## Color

| Token | Value | Use |
|---|---|---|
| `--bg` | `#f6f4f0` | page surface |
| `--surface` | `#ffffff` | cards, popovers |
| `--ink` / `--ink-2` / `--muted` | `#1a1815` / `#4a4640` / `#867f74` | text ramp |
| `--accent` / `--accent-dark` | `#E04F2F` / `#c03d20` | primary action, links, focus |
| `--header-bg` / `--header-ink` | `#16181d` / `#f2efe9` | app shell frame |
| `--ok` / `--critical` / `--major` / `--minor` / `--maintenance` | greens→ambers→blues | impact/status semantics only |

Semantic states ship as tinted pair (e.g. `--critical-soft` bg + `--critical` fg) so
secondary text tints from hue, never plain gray.

## Shape & depth

- Cards: radius 14px, 1px `--border`, hairline shadow (`0 1px 2px`). Hover: lift 2px with
  the soft elevation shadow. One elevation language — never border-plus-hard-shadow.
- Stat cards carry a 2px accent hairline at top — the same accent-underline grammar as the
  active nav item.
- Pills (radius 999px) only for small controls/chips — cards stay at 12–16px radius.
- Dashed hairlines mark ephemeral structure: stat-card footers, detail rows, empty states.

## Motion

One authored moment: the home hero rises (opacity + 10px, 520ms `cubic-bezier(.16,1,.3,1)`,
staggered 70/140ms). Everything else is 120–140ms state transitions (hover, focus,
menu open). `prefers-reduced-motion: reduce` collapses animation duration to 0.01ms
globally.

## States & components

- Loading: skeleton cards (shimmer) for grids, spinner+label for inline waits, 70ms
  animated busy dot in search.
- Empty: dashed-frame state with a line icon, title, and hint copy per context.
- Error: tinted `role="alert"` banner naming the problem (`Graph database unreachable…`)
  with a Retry action; HTTP 503 keeps a stable, non-leaking message (credentials never
  surface).
- Focus: 2px accent outline, 2px offset, on every interactive element.
- Buttons: primary (accent), ghost (surface), dark (header) — 10px radius, 1.5px border,
  80ms press 1px down. Disabled = 55% + not-allowed.
- **Live/Sample pill** (header): green dot for live database, amber dot for sample data —
  the honest-provenance promise, always visible.

## Language

Product voice is factual and terse. Controls name their action ("Copy", "Retry",
"Clear selection"). Errors name the problem and the recovery. No invented user-facing
technobabble outside the graph's own terms (engineers, repos, releases, incidents,
services).

## Layout

Max content width 1100px, 24px page gutters, 40px vertical rhythm on main sections
(section title margin 40px above / 4px below; stacks 14px after). Header: 62px sticky
dark bar, scrollable nav on small screens. Footer: hairline + paper surface, provenance
line always present.

## Accessibility floor

- `:focus-visible` everywhere; skip-link to `#main`.
- Search is a real combobox (`role="combobox"`, `aria-expanded`, `aria-controls`,
  listbox/option semantics, arrow/escape/enter keyboard handling, results announced).
- Copy affordance announces "Copied to clipboard" via a visually-hidden `role="status"`.
- Contrast ≥4.5:1 for body copy on paper and on the dark header.
- `lang="en"`, `colorScheme: light`, themeColor `#16181d`.
- Long identifiers (keys, tags, commit messages) wrap with `overflow-wrap: anywhere`
  instead of overflowing.

## Iconography

Hand-authored 1.6–1.8px stroke SVG, 14–18px in-line, one family: single-line rounded
geometry (graph glyph, warning triangle, search lens, PR nodes, repo box, person,
inbox, path arrows). No emoji, no external icon library.