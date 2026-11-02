export const state={deny:false,actor:"ci-maker",existing:true,decision:"PENDING",logs:[],actions:[],granted:[]};
const list=()=>[{id:"ci-id",userId:"ci-user",walletId:"ci-wallet",handle:"ci",unallocated:1000000n,amountUsdcMicros:1000000n,status:"PENDING",key:"support"}];
const lookup={findMany:async()=>list(),findUnique:async()=>state.existing?{id:"ci-id",status:state.decision,requestedBy:"ci-maker",resource:"withdrawals",operation:"approve",targetId:"ci-withdrawal"}:null};
export const prisma={
 user:{...lookup,findMany:async()=>list()},
 blockchainDeposit:{...lookup},
 withdrawal:{...lookup},
 investorDepositWallet:{...lookup},
 staffRole:{...lookup},
 staffAudit:{...lookup,create:async({data})=>{state.logs.push(data);return data}},
 staffAction:{...lookup,create:async({data})=>{const value={id:"ci-action",status:"PENDING",...data};state.actions.push(value);return value},updateMany:async({where,data})=>{if(state.decision!=="PENDING")return {count:0};state.decision=data.status;return {count:1}}},
 $transaction:async(fn)=>fn(prisma),
};
export function setAdminTestMode(args){Object.assign(state,args)}
