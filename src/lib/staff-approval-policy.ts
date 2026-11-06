/** Approval is distinct from permission to propose or execute a staff action.
 * Super Admin is always eligible; only these additional roles may be enabled.
 */
import {isEditableRoleKey} from "./staff-role-editor-policy.ts";
export const APPROVAL_POLICY_ID="admin-actions";
export function canReviewAsRole(roleKeys:readonly string[],additionalRoles:readonly string[]):boolean{
 return roleKeys.includes("super-admin")||roleKeys.some(key=>
  isEditableRoleKey(key)&&additionalRoles.includes(key));
}

/** Self-approval never qualifies without a current, canonical Super Admin role. */
export function isApprovedActionAuthorized(action:{status:string;requestedBy:string;decidedBy:string|null},requesterIsSuperAdmin:boolean):boolean{
 return action.status==="APPROVED"&&Boolean(action.decidedBy)&&
  (action.decidedBy!==action.requestedBy||requesterIsSuperAdmin);
}
