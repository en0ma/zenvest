export const state={deny:false,actor:"ci-maker",existing:true,decision:"PENDING",logs:[],actions:[],granted:[],freshRequired:false,revocations:0,sessionBumps:0};
const list=()=>[{id:"ci-id",userId:"ci-user",walletId:"ci-wallet",handle:"ci",unallocated:1000000n,amountUsdcMicros:1000000n,status:"PENDING",key:"support"}];
const lookup={findMany:async()=>list(),findUnique:async()=>state.existing?{id:"ci-id",isActive:true,emailVerifiedAt:new Date(),status:state.decision,createdAt:new Date(),requestedBy:"ci-maker",resource:"withdrawals",operation:"approve",targetId:"ci-withdrawal"}:null};
export const prisma={
 user:{...lookup,update:async()=>{state.sessionBumps++;return {}},findMany:async()=>[{id:"ci-id",handle:"ci",email:"ci@example.invalid",isActive:true}]},
 blockchainDeposit:{...lookup},
 withdrawal:{...lookup},
 investorDepositWallet:{...lookup},
 role:{...lookup,findUnique:async()=>state.existing?{id:"ci-role",key:"support"}:null},
 twoFactor:{findUnique:async()=>({verifiedAt:new Date()})},
 userRole:{findUnique:async()=>null,create:async()=>({}),deleteMany:async()=>{state.revocations++;return {count:1}}},
 staffAudit:{...lookup,create:async({data})=>{state.logs.push(data);return data}},
 staffAction:{...lookup,findMany:async()=>[{id:"ci-action",resource:"withdrawals",operation:"approve",status:"PENDING"}],create:async({data})=>{const value={id:"ci-action",status:"PENDING",...data};state.actions.push(value);return value},updateMany:async({where,data})=>{if(state.decision!=="PENDING")return {count:0};state.decision=data.status;return {count:1}}},
 $transaction:async(fn)=>fn(prisma),
};
export function setAdminTestMode(args){Object.assign(state,args)}
