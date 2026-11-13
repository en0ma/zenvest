/** CI-only authenticated staff identity; routes still enforce live DB roles,
 * sandbox admission policy, capacity and transaction locking. */
export const requireStaffPermission=async()=>"ci_bot_admin";
