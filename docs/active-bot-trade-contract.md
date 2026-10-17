# Active bot trade snapshot contract

The external Python trading bot writes **one row per bot ID** to PostgreSQL table `active_bot_trade`. The primary key is `bot_id`, so each update overwrites the previous snapshot for that bot.

Columns:
- `bot_id`: unique identifier for the bot
- `status`: existing `BotRunState` enum (`OFFLINE`, `IDLE`, `MONITORING`, `TRADING`, `PAUSED`, `ERROR`)
- `event_ticker`: currently selected 15-minute Kalshi market ticker, nullable when not monitoring a market
- `yes_contracts`, `no_contracts`: current inventory counts for that market
- `yes_cost_usdc_micros`, `no_cost_usdc_micros`: nonnegative aggregate inventory acquisition cost in USDC micros (1 USDC = 1,000,000 micros)
- `as_of`: UTC timestamp when the bot measured this snapshot
- `updated_at`: UTC time when row was last updated

Use a parameterized PostgreSQL upsert with `ON CONFLICT (bot_id) DO UPDATE`. Update every field together and always set `as_of` and `updated_at` to appropriate timestamps. Store whole-number micros, not float currency values. When switching to a new event, reset inventories and cost fields for the new ticker.

The dashboard reads the newest `as_of` snapshot. If its timestamp is more than 90 seconds old it shows **Status unavailable** and dashes instead of presenting potentially stale inventory as current. This bot-level summary is informational and does not establish any individual investor's allocations or balances.

The database migration must be applied before the dashboard version is deployed. No bot credential or public bot-write endpoint is added.
