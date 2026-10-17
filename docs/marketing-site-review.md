# Public website redesign and content boundaries

## Delivered
- Homepage with professional product-oriented navigation, hero, visual capital reporting illustration, capabilities, how-it-works, yield source, risk section, FAQ and call-to-actions.
- Public docs, FAQ, website terms, privacy overview and full risk disclosure routes.
- Mobile-responsive layout, accessible native FAQ accordions and reduced-motion behavior.
- Excalidraw editable diagram source: `design/capital-lifecycle.excalidraw`; companion responsive vector flow rendered in the marketing site, inspired by the same hand-drawn layout.
- Login/registration surfaces receive visual updates; protected admin routes remain unchanged and are not linked publicly.
- Public social channels are intentionally not linked until verified handles are supplied. Never invent official X or Telegram links.

## Verification and legal limits
The public information must not falsely claim licensing, guaranteed yield, live deposit/withdrawal support, investment availability or verified custodied equity. The site explicitly states that onboarding/reporting can be accessed but live funding is not yet enabled. Current website terms/privacy are provisional informative policies; counsel and the responsible corporate entity must finalize terms, KYC/AML and regulatory disclosures before offering an investment service.

No real trading bot code, bank account, custody flow, return projection or dashboard authority is added here.

## Visual review checklist
- Mobile 360px and desktop 1440px: header CTA, typography, card grid, native FAQ, footer links
- Home login/register action and documentation anchors
- Links to /docs, /risk, /terms, /privacy, /faq
- Public pages do not link to /admin or /preview/admin
- Reduced motion, contrast and focus keyboard behavior
- Legal copy review and approved public links required before distribution

## Mintlify setup
The standalone Mintlify project lives under `mintlify/`, with `docs.json` and MDX source. In Mintlify, connect GitHub `en0ma/zenvest` with the docs root set to `mintlify`. Once Mintlify provides a hosted documentation URL, set `NEXT_PUBLIC_DOCS_URL` in Vercel to that URL and redeploy so all marketing Docs links open the Mintlify site. Until then they fall back to the existing `/docs` route, not a nonfunctional placeholder. 

Twitter and Telegram links intentionally use the requested `@demo` placeholders (`https://x.com/demo`, `https://t.me/demo`) and must be replaced with Zenvest's actual accounts when issued.

## Responsive details
Mobile < 1024px uses a native disclosure menu for the public navigation; login and create account remain independently accessible. Hero text, feature grid, process cards, flow diagram and footer use responsive sizing and wrapping.
