# Investor activity history — foundation

This change introduces `InvestorActivity`, an account-scoped informational event history. The authenticated investor dashboard only queries entries belonging to its own `portfolioId`, and displays a truthful empty state until events exist.

## Security and accounting boundaries
- No public or administrative write endpoint is added; there is no UI allowing event creation, deposits, withdrawals, or balance changes.
- Events are **not** a double-entry ledger, do not create monetary value, and do not prove funds are in custody.
- Future posting flows must be authenticated, idempotent by external reference, paired with authoritative ledger entries in one transaction, and audited before a payment or allocation status is represented as final.
- `amountKobo` is signed integer kobo, not floating point NGN. The currency for this history is NGN.
- The database migration is additive and creates no seed events.
- Investor history is rendered from the existing `requireUser()` identity, not a client-supplied user ID.

## Next steps
1. Implement proper double-entry ledger and reconciliation.
2. Define bank deposit matching, custody and FX conversion workflows.
3. Connect eligible trade allocation snapshots and settled trade accounting.
4. Implement withdrawal request state machine and approval controls.
5. Add full audit trails and permission boundaries.

The homepage and preview functionality are unchanged.
