import {STAFF_PERMISSIONS} from "./staff-permissions.ts";
export const RESERVED_ROLES=["user","super-admin"] as const;
export const ROLE_KEY_PATTERN=/^[a-z][a-z0-9-]{2,39}$/;
const investorBaseline=new Set<string>(["account:access","portfolio:read:own","wallet:read:own","deposits:create:own","withdrawals:create:own","allocations:create:own"]);
/** Admin role editor may only grant existing, supported staff capabilities.
 * The Super Admin role and mandatory investor baseline are not editable.
 * roles:manage can never be granted through this editor.
 */
export const EDITABLE_ROLE_PERMISSIONS=STAFF_PERMISSIONS.filter(key=>!investorBaseline.has(key)&&key!=="roles:manage");
export function isEditableRoleKey(key:string):boolean{
 return ROLE_KEY_PATTERN.test(key)&&!(RESERVED_ROLES as readonly string[]).includes(key);
}
export function validateRoleGrants(roleKey:string,permissionKeys:readonly string[]):boolean{
 return isEditableRoleKey(roleKey)&&permissionKeys.length<=EDITABLE_ROLE_PERMISSIONS.length&&
 new Set(permissionKeys).size===permissionKeys.length&&
 permissionKeys.every(key=>(EDITABLE_ROLE_PERMISSIONS as readonly string[]).includes(key));
}
