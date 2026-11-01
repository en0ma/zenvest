# Zenvest — living project handoff

Updated: 2026-11-01. Repository: en0ma/zenvest. Read this document, README.md, the live code, and current GitHub PRs before acting. Actual code and live GitHub state take precedence over old notes.

## Product direction
Zenvest is an investor-facing Next.js / TypeScript / Prisma / PostgreSQL platform with NextAuth, optional second factor, Solana USDC custody through Blockradar, strategy allocations, verified settlement accounting, and investor dashboards. It is in development/pre-production, not an assurance that customers can currently deposit or invest. Monetary calculations use integer micro-USDC and verified, idempotent settlement. No guaranteed returns.

Brand: simple, approachable, everyday-investor language. The public homepage should communicate an alternative investment opportunity and a hands-off systematic approach, not trading-terminal jargon or claims of directly offering stocks, property, or funds. Preserve honest disclosures.

## Current design
PR #83 branch feature/homepage-editorial-investing is the marketing homepage redesign. On November 1, the user explicitly approved a particular Risevest-inspired screenshot with a welcoming portrait hero: headline “Discover another way to put your money to work.”, supporting text “Access a strategy-driven investment opportunity with a simple, hands-off experience.”, and a pale lavender “How it works” panel: “You invest. Zenvest handles the strategy.”, followed by Choose your investment / We handle the strategy / Track your progress. Treat that approved screenshot as the target; do not redesign unrequested elements. Current implementation approximates composition and typography; portrait image parity requires incorporating the exact approved image asset into the repo and browser-based comparison. Don't call it pixel-perfect without verifying.

## Historical PR state
PR #55 treasury accounting merged October 27; PR #56 marketing venue language merged October 27; PR #57 plain-language copy closed unmerged October 30. Re-verify all statuses. PR #84 is a separate draft for the living handoff.

## Maintenance rule
Every future commit should update this file in the same commit, even if only a concise change-log entry. Keep date, changes, architectural decisions, current work, and blockers accurate. Resolve handoff conflicts when concurrent PRs modify it. This convention is not yet CI-enforced. Do not merge or deploy or change main without explicit approval.

## Change log
- 2026-11-01: Reworked PR #83 homepage structure/copy to reflect the explicitly approved Risevest-inspired visual. Main source: src/app/page.tsx. Removed the prior three interactive examples from the rendered homepage. Exact portrait asset and pixel-comparison validation remain outstanding.
