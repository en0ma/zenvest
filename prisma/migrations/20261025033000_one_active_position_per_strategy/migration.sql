-- Only one non-closed position per investor and strategy. A CLOSING
-- position still owns custody exposure and must not be bypassed.
-- Existing duplicates will make this migration fail intentionally;
-- reconcile them through the audited position workflow, never delete funds.
CREATE UNIQUE INDEX "positions_one_active_per_user_strategy"
ON "positions" ("user_id","strategy_id")
WHERE "status" IN ('OPEN','CLOSING');
