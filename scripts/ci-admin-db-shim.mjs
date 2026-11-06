export const state={deny:false,actor:"ci-maker",existing:true,decision:"PENDING",logs:[],actions:[],granted:[],freshRequired:false,revocations:0,sessionBumps:0,reviewerRoles:[],policyChanges:0,reviewerRoleByActor:{"ci-maker":"super-admin","ci-checker":"super-admin","ci-admin":"super-admin"}};
const list=()=>[{id:"ci-id",userId:"ci-user",walletId:"ci-wallet",handle:"ci",unallocated:1000000n,amountUsdcMicros:1000000n,status:"PENDING",key:"support"}];
const lookup={findMany:async()=>list(),findUnique:async()=>state.existing?{id:"ci-id",isActive:true,emailVerifiedAt:new Date(),status:state.decision,createdAt:new Date(),requestedBy:"ci-maker",resource:"users",operation:"write",targetId:"ci-user"}:null};
export const prisma={
 user:{...lookup,update:async()=>{state.sessionBumps++;return {}},findMany:async()=>[{id:"ci-id",handle:"ci",email:"ci@example.invalid",isActive:true}]},
 blockchainDeposit:{...lookup},
 withdrawal:{...lookup},
 investorDepositWallet:{...lookup},
 role:{...lookup,findUnique:async()=>state.existing?{id:"ci-role",key:"support"}:null},
 twoFactor:{findUnique:async()=>({verifiedAt:new Date()})},
 userRole:{findUnique:async()=>null,findFirst:async()=>state.reviewerRoleByActor[state.actor]==="super-admin"?{userId:state.actor}:null,
  findMany:async()=>[{role:{key:state.reviewerRoleByActor[state.actor]??"user",grants:[{permission:{key:"audit:read"}}]}}],
  create:async()=>({}),deleteMany:async()=>{state.revocations++;return {count:1}}},
 staffApprovalPolicy:{findUnique:async()=>({additionalRoleKeys:state.reviewerRoles}),upsert:async({create,update})=>{state.reviewerRoles=[...(update.additionalRoleKeys??create.additionalRoleKeys)];state.policyChanges++;return {}}},
 staffAudit:{...lookup,create:async({data})=>{state.logs.push(data);return data}},
 staffAction:{...lookup,findMany:async()=>[{id:"ci-action",resource:"users",operation:"write",status:"PENDING"}],create:async({data})=>{const value={id:"ci-action",status:"PENDING",...data};state.actions.push(value);return value},updateMany:async({where,data})=>{if(state.decision!=="PENDING")return {count:0};state.decision=data.status;return {count:1}}},
 $transaction:async(fn)=>fn(prisma),
};
export function setAdminTestMode(args){Object.assign(state,args)}
