# Zenvest — DESIGN.md

## Status and continuity
This is the current visual implementation guide for the **Opportunity Engine** direction in PR #23. The handoff and approved user decisions take precedence over general inspiration. `docs/zenvest-design-system.md` documents an older PR #22 direction; retain it as history, but do not use its superseded palette or hero copy.

## Product and voice
Zenvest is an approachable investor experience for exploring systematic opportunities in 15-minute Bitcoin event markets. It is **not** a trading terminal, a directional Bitcoin forecast service, or a guaranteed-yield product. The separate trading system reports operational telemetry; per-investor accounting requires independently reconciled records. Never portray seeded/demo telemetry, intended reinvestment, custody, or unimplemented deposits/withdrawals as live financial results.

## Locked marketing and navigation
- Hero: **“More investors are seeking more ways to grow.”**
- Supporting copy: **“Zenvest opens access to a new kind of opportunity through a simple platform designed for investing, not complex trading.”**
- Public navigation: The idea / Why it's different / Log in / Get started.
- Footer: **“Exploring new investment opportunities in fast-moving markets.”**
- Keep existing section sequence, investment proposition and dedicated risk section. Do not add standalone diagram sections, repeated cards or icon strips without approval.
- Audience includes first-time investors, stock investors, crypto traders, and people interested in “sports betting and predictions.”

## Visual system
| Role | Token | Value |
| --- | --- | --- |
| Core typography | `--zen-ink` | `#0A2540` |
| Brand action | `--zen-accent` | `#635BFF` |
| Subtle accent | `--zen-accent-soft` | `#EEEDFF` |
| Page background | `--zen-canvas` | `#F6F9FC` |
| Content surface | `--zen-surface` | `#FFFFFF` |
| Border | `--zen-border` | `#E3E8EE` |
| Supporting text | `--zen-secondary` | `#425466` |
| Focus | `--zen-focus` | `#635BFF` |

Use confident sans-serif display type, tabular financial numerals, generous but deliberate whitespace, clear contrast, restrained corner rounding and minimal borders. Avoid generic AI look, intrusive gradients, pseudo-market charts, fictional returns, unverified credibility claims or brand-asset imitation.

## Signature motif: Opportunity Engine
An original abstract sequence of **repeating curved windows** represents new chances to *evaluate* a market, **not earnings, price movement, automated profit or portfolio growth**. Embed it inside an existing visual region, isolated from copy and interactive elements. Decorative SVG must be `aria-hidden`, non-interactive and appropriately clipped. Use staggered indigo-to-cyan lines and restrained opacity; do not introduce a separate infographic or additional marketing section.

## Homepage and account preview
The headline is the first visual priority. Graphic artwork occupies reserved space and never overlaps copy or CTAs. The investor preview depicts actual product concepts (USDC capital allocation, Deposit, Monitor), remains modest in size (roughly 320–350px) and avoids fictional money amounts and percent returns. Preview gestures are illustrative, not working investment controls. Do not add an illustrative-concept caption the user previously removed.

## Investor experience
Five investor destinations: Overview, Wallet, Activity, Strategy, Settings. Current-page navigation is explicit and accessible. Portfolio balances and activity dominate; separate bot telemetry is visually subordinate, freshness-qualified and never equivalent to investor P&L. USDC amounts are `BigInt` micros (1 USDC = 1,000,000 micros); preserve existing database, authentication and accounting logic.

## Motion and responsiveness
Motion should communicate rhythm or UI state, not fake performance. Use short and subtle transitions, avoid animated layout shifts, and honor `prefers-reduced-motion`. Check 375, 430, 768, 1024 and 1440px widths; verify no clipped headings, horizontal scroll or obscuring graphics. Ensure visible keyboard focus and readable mobile navigation.

## Workflow
Use the existing PR #23 for related improvements, verify CI and preview deployments, and report exact commits. Do not merge without explicit user approval. Verify screenshot-level behavior before claiming visual QA passed.

## Inspiration synthesis (not copied layouts)
- Wise: confident, benefit-led typography and focused action.
- Ramp: product interface as concrete evidence of usability.
- Aave: single concept-driven visual metaphor without importing yield claims.
- 60fps.design: restrained feedback and purposeful motion.
- loadmo.re: mobile composition deliberately designed for narrow screens.
- Supahero, Navbar Gallery and CTA Gallery: clear first-screen hierarchy, legible navigation and selective CTAs.
