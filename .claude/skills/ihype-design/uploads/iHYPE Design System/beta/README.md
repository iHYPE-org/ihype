# iHYPE — Beta Launch Package

Everything needed to take iHYPE from a polished front-end prototype to a launchable beta. Files split between **engineering handoff** (project root) and **visual / GTM assets** (`beta/`).

> **Status:** product is built and LIVE. 501(c)(3) certified, Stripe Connect attached to the nonprofit bank account — real ticket charges, real Connect transfers, real webhook-verified payouts released automatically per show.

---

## 🛠 Engineering handoff (project root)

| File | What it is |
|------|-----------|
| `BACKEND_SPEC.md` | Data model + API surface. Start here. |
| `schema.sql` | Postgres DDL — 16 tables, 8 enums, frozen-charter split, free-use crate trigger, double-entry ledger. |
| `openapi.yaml` | OpenAPI 3.1 contract (~40 endpoints), all live. |
| `seed_data.json` | Realistic mock data matching the schema, so the test env isn't empty. |

## 🎨 Visual & GTM assets (`beta/`)

| File | Use |
|------|-----|
| `demo-walkthrough.html` | Guided, auto-advancing tour of the live fan app. **Best for demos.** |
| `product-brief.html` | Printable one-pager — press, venues, artists. |
| `app-store-kit.html` | Framed screenshots + App Store / Play listing copy. |
| `tester-guide.html` | Send with invite codes — what to test, how to report, what's fake. |
| `feedback-board.html` | Kanban for triaging beta feedback. |
| `notification-templates.html` | Push notification card designs. |
| `email-templates.html` | Magic-link, ticket receipt, referral-payout emails. |
| `error-screen.html` | Branded crash fallback. |

The 12-slide **Beta Launch Deck** lives at `templates/beta-launch-deck/` (it's a reusable template, not a one-off).

---

## ✅ What's live
Beta invite gate · skip-to-demo · onboarding · 3-tab app (Listen/Events/Pages) · hype + budgets · Seeds discovery · direct ticketing + QR wallet · referral earnings · DJ radio studio · live shows + chat · 4 platforms (Desktop/Mobile/iOS/Android) · feedback widget · analytics · reset-data · legal disclaimers · Stripe Connect onboarding · real ticket charges · settlement transfers · promoter payouts. See `BACKEND_SPEC.md` §5 for the full live-surface list.
