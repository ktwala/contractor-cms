# PR-UI-TOKENS-1 — Hubsec Workforce theme tokens (CMS)

**Status:** Applied  
**Scope:** Colours + app shell (dark sidebar). Spacing and layout structure unchanged.

## Source

Aligned with **Hubsec Workforce** visual direction:

- Dark navy sidebar
- Purple / indigo active nav
- Cyan focus ring
- White cards on light grey page
- Purple primary actions and links

## Token map

Defined in `frontend/app/globals.css` (`:root`):

| Token | Value | Usage |
|-------|-------|--------|
| `--sidebar-bg` | `#1f2b3d` | Sidebar background |
| `--sidebar-border` | `#314056` | Sidebar / header dividers |
| `--sidebar-text` | `#cbd5e1` | Nav link text |
| `--sidebar-muted` | `#8b97aa` | Section labels |
| `--sidebar-active-bg` | `#37338f` | Active nav item |
| `--sidebar-active-border` | `#38bdf8` | Active nav cyan ring |
| `--brand-purple` | `#5b3fd6` | Buttons, links (`primary-600`) |
| `--brand-purple-dark` | `#4338ca` | Hover states |
| `--page-bg` | `#f8fafc` | Page background |
| `--card-bg` | `#ffffff` | Cards, top bar |
| `--card-border` | `#e2e8f0` | Card borders |
| `--text-main` | `#111827` | Body headings |
| `--text-muted` | `#475569` | Secondary text |
| `--warning` | `#eab308` | Warnings |
| `--danger` | `#ef4444` | Errors / danger |

## Files touched

| File | Change |
|------|--------|
| `frontend/app/globals.css` | CSS variables + component classes (`.sidebar-*`, `.btn-*`, `.card`, `.input`) |
| `frontend/tailwind.config.ts` | Tailwind colour aliases; `primary` scale → purple |
| `frontend/components/dashboard-layout.tsx` | Dark sidebar shell, active nav styling |
| `frontend/components/dashboard/DashboardNavCards.tsx` | Text token classes |
| `frontend/app/login/page.tsx` | Page bg + link/button tokens |

## Component classes

```text
.sidebar-shell          — navy sidebar container
.sidebar-brand          — white product title
.sidebar-section-label  — muted uppercase group labels
.sidebar-nav-link       — default nav item
.sidebar-nav-link-active — purple fill + cyan ring
.app-topbar             — white sticky header
.page-heading / .page-subheading — main content typography
.link-brand              — purple links
```

Legacy `primary-*` Tailwind classes now resolve to the purple scale, so existing pages pick up brand colour without a full refactor.

## Out of scope (for now)

- Dashboard module accent borders (per-module colours retained)
- PDP / settings one-off layouts
- Full typography scale change
- Hubsec logo asset swap

## Verify locally

```bash
docker compose up -d frontend
# Open http://localhost:3001/login → sign in → check dark sidebar + purple active item
```
