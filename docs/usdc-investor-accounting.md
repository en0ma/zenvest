# Investor denomination: USDC

Investor balances, deposit/withdrawal records and activity should use **USDC**, represented as signed PostgreSQL BIGINT integer **micros** (1 USDC = 1,000,000 micros). This matches the bot trading cost unit and avoids a required NGN/USD conversion pipeline.

The migration adds new zero-initialized `*_usdc_micros` columns to `investor_portfolios` and `amount_usdc_micros` to `investor_activity`. It deliberately preserves all old `*_kobo` columns and rows, and **never performs an implicit FX conversion**. Therefore old NGN sandbox values are not presented as USDC. Existing records from NGN history need a separate, verified and auditable conversion or reconciliation process if they represent actual balances; no automatic conversion is performed in this PR.

The investor-facing UI reads the USDC columns. The optional investor sandbox seed now populates only USDC demo balances and refuses accounts with existing nonzero NGN or USDC balances.

**Scope:** Reporting denomination and storage only. This does not create real USDC custody, on-chain deposit addresses, deposit monitoring, blockchain confirmation handling, wallet ownership checks, withdrawal signing, chain/network support, or reconciliation. These must be designed, implemented, reviewed and tested before deposits/withdrawals can be enabled. Avoid promising that there is no FX exposure: Kalshi settlement, custody, on/off ramps, and USDC redemption/network risk can still matter.
