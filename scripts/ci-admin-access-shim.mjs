import {state} from "./ci-admin-db-shim.mjs";
export async function requireStaffPermission(key){
 state.granted.push(key);
 if(state.deny)throw Error("FORBIDDEN");
 return state.actor;
}
