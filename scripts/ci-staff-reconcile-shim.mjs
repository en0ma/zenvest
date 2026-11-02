export const state={deny:false,actionStatus:"APPROVED",decidedBy:"checker",depositStatus:"CONFIRMING",creditedAt:null,masterWalletId:"ci-master",claims:0,audit:[],requests:0,providerStatus:200};
export async function requireStaffPermission(permission,options){
 if(permission!=="deposits:reconcile"||options?.requireFreshLogin!==true||state.deny)throw Error("FORBIDDEN");
 return "executor";
}
export function blockradarConfig(){return {key:"ci-api-key",walletId:"ci-master"}}
const action=()=>({id:"ci-action",resource:"deposits",operation:"reconcile",status:state.actionStatus,requestedBy:"maker",decidedBy:state.decidedBy,targetId:"ci-deposit"});
const deposit=()=>({id:"ci-deposit",status:state.depositStatus,creditedAt:state.creditedAt,providerTransactionId:"ci-transaction",wallet:{masterWalletId:state.masterWalletId,status:"ACTIVE",provider:"BLOCKRADAR",network:"solana"}});
export const prisma={
 staffAction:{findUnique:async()=>action(),updateMany:async()=>{if(state.actionStatus!=="APPROVED")return {count:0};state.actionStatus="EXECUTED";state.claims++;return {count:1}}},
 blockchainDeposit:{findUnique:async()=>deposit()},
 staffAudit:{create:async({data})=>{state.audit.push(data);return data}},
 $transaction:async(fn)=>fn(prisma),
};
