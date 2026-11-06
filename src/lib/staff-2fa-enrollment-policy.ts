/** Every non-baseline role is a staff membership, including dynamically created roles. */
export function needsStaffTwoFactor(roleKeys:readonly string[],enrolled:boolean):boolean{
 return !enrolled&&roleKeys.some(key=>key!=="user");
}
