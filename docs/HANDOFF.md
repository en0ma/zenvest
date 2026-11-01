# Zenvest — living project handoff

Updated: 2026-11-01. Repository: en0ma/zenvest. Read this document, README.md, the live code, and current GitHub PRs before acting. Actual code and live GitHub state take precedence over old notes.

## Product direction
Zenvest is an investor-facing Next.js / TypeScript / Prisma / PostgreSQL platform with NextAuth, optional second factor, Solana USDC custody through Blockradar, strategy allocations, verified settlement accounting, and investor dashboards. It is in development/pre-production, not an assurance that customers can currently deposit or invest. Monetary calculations use integer micro-USDC and verified, idempotent settlement. No guaranteed returns.

Brand: simple, approachable, everyday-investor language. The public homepage should communicate an alternative investment opportunity and a hands-off systematic approach, not trading-terminal jargon or claims of directly offering stocks, property, or funds. Preserve honest disclosures.

## Current design
PR #83 (feature/homepage-editorial-investing) now targets the latest approved **single-section** marketing hero with no lower explainer cards or second section. Reference screenshot supplied by user on 2026-11-01: welcoming braided Black woman in a purple sweater on the right, soft lavender curves, prominent left headline “Discover another way to put your money to work.”, copy “Access a different kind of investment opportunity. Choose how much to invest, while Zenvest handles the strategy behind the scenes.”, and one “Get started” CTA. Main ink #14253D comes from the login and registration pages. This branch approximates the composition using a remote Black-woman portrait; the approved generated portrait itself is not a committed source asset, so strict pixel parity has not been verified. Do not re-add a lower feature strip unless asked.

## Historical PR state
PR #55 treasury accounting merged October 27; PR #56 marketing venue language merged October 27; PR #57 plain-language copy closed unmerged October 30. Re-verify all statuses. PR #84 is a separate draft for the living handoff.

## Maintenance rule
Every future commit should update this file in the same commit, even if only a concise change-log entry. Keep date, changes, architectural decisions, current work, and blockers accurate. Resolve handoff conflicts when concurrent PRs modify it. This convention is not yet CI-enforced. Do not merge or deploy or change main without explicit approval.

## Change log
- 2026-11-01: Corrected PR #83 hero asset sizing to avoid overscaled/distorted portrayal, bounded hero sizing by viewport, removed portrait mask, and restored the shared `MarketingFooter`. The existing `public/approved-portrait.webp` remains an insufficiently compressed low-resolution crop; replacing it with high-resolution approved artwork remains necessary. Do not mistake layout correction for final pixel parity.
- 2026-11-01: Replaced incorrect Unsplash image in PR #83 with `public/approved-portrait.webp`, a locally stored crop of the **exact Black woman from the user's approved 1536x1024 screenshot**. The crop was optimized to 420x458 WebP for repository transfer; imagery is the correct subject, but full-resolution and pixel-perfect QA remain outstanding. Kept functional hero text and links.
- 2026-11-01: Removed marketing footer from PR #83 so the approved single-screen hero is not followed by an unapproved extra section. Compared user's 1536×1024 approved screenshot to deployed commit 99e11b0. Correct portrait source now committed as an optimized screenshot crop; full-resolution asset is still desirable. Do NOT claim pixel-perfect parity or substitute another stock portrait. Await exact asset import and visual comparison.
- 2026-11-01: Refined PR #83 desktop composition against the explicit 1536×1024 screenshot: header height, hero scale, copy placement, gradient, lavender shapes, and navy #14253D. Kept functional links and one hero section. Exact portrait photo still unavailable as a repository asset; current remote placeholder is not the approved photo, so pixel-perfect parity is unresolved.
- 2026-11-01: Implemented user-approved single-section hero in PR #83, removed second section entirely, aligned text/nav ink to auth-page navy #14253D, updated portrait to a Black woman (external image placeholder). Exact image parity and responsive visual QA remain outstanding.
- 2026-11-01: CI repair: restored the entire repository tree after an incorrectly constructed commit retained only two files, preventing Vercel from detecting package.json / Next.js. Homepage visual changes preserved. Validate deployment again.
- 2026-11-01: Reworked PR #83 homepage structure/copy to reflect the explicitly approved Risevest-inspired visual. Main source: src/app/page.tsx. Removed the prior three interactive examples from the rendered homepage. Exact portrait asset and pixel-comparison validation remain outstanding.
