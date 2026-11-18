/** CI-only stand-in for authenticated manager's session; the API's own
 * manager-key authentication, role/2FA lookup, DB ownership and rate limiting
 * are all exercised against real disposable PostgreSQL. */
export const currentBotManager=async()=>"ci_bot_api_manager";
