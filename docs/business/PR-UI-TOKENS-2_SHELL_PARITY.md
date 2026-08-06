# PR-UI-TOKENS-2 — Shell parity (Hubsec Workforce)

**Goal:** Align External Workforce Platform shell with Hubsec Workforce shell while preserving platform information architecture and dashboard behaviour.

## Scope

- Sidebar brand: purple icon block + **Hubsec EWP** title
- Top bar: menu control, **Refresh permissions**, avatar + user details
- Main content: increased top padding and wider max width
- Active nav: stronger cyan glow; active purple aligned to brand token
- Cards: `rounded-xl` + subtle shadow (less flat)
- Charts: dashed empty-state panels when series values are all zero

## Key files

| Area | Path |
|------|------|
| Shell layout | `frontend/components/dashboard-layout.tsx` |
| Brand mark | `frontend/components/ui/hubsec-brand.tsx` |
| Chart empty state | `frontend/components/ui/chart-panel.tsx` |
| Tokens / utilities | `frontend/app/globals.css` |
| Analytics charts | `frontend/components/dashboard/AnalyticsDashboard.tsx` |

## Out of scope

- Full page redesign of list/detail screens
- Login/register marketing copy refresh (metadata title updated only)
