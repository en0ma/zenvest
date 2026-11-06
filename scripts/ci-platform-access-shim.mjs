export async function requireStaffPermission(permission,options){
 if(permission!=="wallets:operate"||options?.requireFreshLogin!==true)throw Error("Access denied");
 return "ci-executor";
}
