# Zenvest — living project handoff

**Last reviewed:** 2026-10-31  
**Canonical repository:** `en0ma/zenvest`  
**Primary development branch:** `main`

> This is the entry point for a new contributor or a new AI conversation. Read this file, then inspect the current code and open pull requests. The code and live GitHub state override any stale statements here.

## Maintenance rule (for every future commit)

**Every code, configuration, documentation, or design commit must update this handoff in the same commit** to describe any change to project state, even if the change is small. Keep it concise and accurate; for no meaningful product-state impact, add a brief entry explaining that. Do not copy stale PR states forward without checking GitHub. Update the date, current work, affected components, noteworthy decisions, unresolved risks, and the change log as appropriate. Keep summaries useful for a fresh conversation, not an exhaustive diff.

On feature branches, update this file with each commit. When parallel PRs touch this document, resolve conflicts by preserving both sets of relevant changes and confirming current state. A PR reviewer should check that the handoff is updated. This is a **project convention**, not yet a CI-enforced rule.

**If continuing this project in a new chat:** start by reading `docs/HANDOFF.md`, `README.md`, current `prisma/schema.prisma`, and the relevant source files. Check GitHub PR and CI status directly. Never assume this document alone reflects the latest branch state. Do not merge, deploy, or modify `main` without explicit authorization.

## Product and direction

Zenvest is a developing investor operations and USDC custody platform. The intended user experience is approachable and mobile-first: register, fund a wallet, choose a strategy, and track investments/results without trading-terminal complexity. Public language should lead with benefits and plain English rather than trading jargon. Avoid publicly identifying Kalshi as the execution venue; do not imply guaranteed returns. Maintain accurate risk disclosures in the appropriate places.

The marketing homepage is not evidence that every illustrated asset category is available to invest in. Illustrative charts and controls must be identified as such.

## Stack and architecture

- Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 3.
- Prisma 6 + PostgreSQL, NextAuth v4 credentials/JWT, Resend email.
- Blockradar-based Solana USDC custody events; strategy/position accounting and integration boundaries involving Kalshi.
- Money accounting uses integer micro-USDC (`BigInt`), not floating-point balances.
- Main locations: `src/app/` (UI/API), `src/components/` (UI), `src/lib/` (domain and workers), `prisma/` (schema/migrations), `tests/`, `scripts/`, `docs/architecture/`, `.github/workflows/ci.yml`.
- `README.md` contains the architecture, money-flow semantics, release gates, and setup details.

**Financial safety invariants:** reserve funds before settlement; do not credit deposits or returns without independent verified confirmations; keep settlement transactional and idempotent; use explicit reconciliation for ambiguous results; keep investor principal separate from platform fees and profits. Not all live provider integrations are complete; README describes the project as pre-production.

## Account and investor experience

- Investor views include Overview, Wallet, Earn, and Settings.
- `src/lib/auth.ts` and `src/lib/two-factor.ts` currently implement optional per-user second-factor challenge handling, email/app verification, recovery codes, and security sessions. The October 27 external handoff predates these changes.
- Performance reconstruction lives in `src/lib/portfolio-performance.ts`; show available confirmed history without falsely claiming fully reconciled returns.
- Mobile-first interfaces and human-readable money labels remain preferred.

## Current work and PRs (checked 2026-10-31)

- **PR #83** — `feature/homepage-editorial-investing`, **open draft and unmerged** at inspection. Two-section homepage, landscape SVG, and an illustrative interactive USDC amount selector. Files: `src/app/page.tsx`, `src/components/home-investment-demo.tsx`, `public/home-investment-landscape.svg`. Screenshot supplied in the working conversation on October 31. PR description requests design/preview review before merge. The investment-options display and line chart are illustrative; do not assume they are live investments or projections.
- **PR #55** — verified ALLOCATE return / deposit fee treasury changes; merged 2026-10-27.
- **PR #56** — removed public Kalshi execution claim; merged 2026-10-27.
- **PR #57** — early plain-language copy PR; closed without merge 2026-10-30. Some comparable copy may appear in subsequent code; judge actual source, not old PR intent.

Always re-check GitHub for newer PRs, new merges, branch divergence, and CI results.

## Unresolved / future review

- Validate financial and security paths against current source before making changes; do not extrapolate from old conversation notes.
- Check which external destination-receipt and return integrations remain pending before describing actual live fund movement.
- Review homepage PR #83 responsive behavior and preview; do not conflate illustrative investment choices with supported products.
- Keep explicit separation between educational marketing claims and implemented functionality.
- If changing two-factor authentication, preserve opt-in behavior and ensure enabled users cannot receive authenticated sessions without successful verification.

## Decisions and collaboration preferences

- Plain-language investing copy; reduce trading-centric vocabulary in investor-facing UX.
- Opt-in authenticator-app or email 2FA under Settings > Security.
- Exact user-approved copy matters. Don't append unsolicited marketing language.
- Prototypes described as interactive must genuinely respond to user actions.
- No merge/deployment or unsolicited `main` changes.
- Build new changes on reviewable branches and PRs when asked.

## Change log (newest first)

- **2026-10-31 — living handoff established:** Added this repository handoff and the rule to update it in every future commit. No runtime, financial, or UI behavior changed.

## Next conversation starter

“Review `docs/HANDOFF.md` in `en0ma/zenvest`, then inspect the actual current repository and PRs. Treat the handoff as a guide to intent, not as authoritative code state. Before implementing anything, distinguish what is merged, in open PRs, and only proposed. Update the handoff within every commit.”
