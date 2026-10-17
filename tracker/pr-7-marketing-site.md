# PR 7 — Premium public experience

## Audit
Original homepage consisted of prototype controls including a public admin preview, without documentation, risk copy, FAQs or site policies. User wants a Stripe-inspired investment information site with Excalidraw diagram, docs, legal links and account access. Backend investor accounting is not ready for funds.

## Requirement coverage
- Public landing page: premium hero, strategy, features, Excalidraw-inspired illustration, FAQ, CTA and footer — implemented
- Admin links removed from public navigation — implemented; existing internal admin remains protected
- Docs center with overview, yield and allocation rules — implemented
- Terms, privacy and risk pages — implemented as interim explanatory content; counsel review required
- Login and registration styling — implemented
- X and Telegram destinations — intentionally not invented; placeholder text only until verified official accounts supplied
- Editable Excalidraw source — design/capital-flow.excalidraw
- No guaranteed returns or misleading live funding instructions — implemented, specific readiness notice retained
- CI — pending

## External gates
Legal/offer terms, privacy controller details, regulatory eligibility, proper support contacts and verified social URLs must be completed by operator before public investor solicitation. Real-money funding remains unavailable in the codebase.
