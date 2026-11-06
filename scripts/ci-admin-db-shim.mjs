export const state={deny:false,actor:"ci-maker",existing:true,decision:"PENDING",logs:[],actions:[],granted:[],freshRequired:false,revocations:0,sessionBumps:0,reviewerRoles:[],policyChanges:0,roleEdits:0,roleCatalog:{support:["users:read"],operations:["users:read","wallets:operate"],finance:["balances:read"],auditor:["audit:read"],user:["account:access"],"super-admin":["roles:manage"]},reviewerRoleByActor:{"ci-maker":"operations","ci-checker":"super-admin","ci-admin":"super-admin"}};
const list=()=>[{id:"ci-id",userId:"ci-user",walletId:"ci-wallet",handle:"ci",unallocated:1000000n,amountUsdcMicros:1000000n,status:"PENDING",key:"support"}];
const lookup={findMany:async()=>list(),findUnique:async()=>state.existing?{id:"ci-id",isActive:true,emailVerifiedAt:new Date(),status:state.decision,createdAt:new Date(),requestedBy:"ci-maker",resource:"users",operation:"write",targetId:"ci-user"}:null};
export const prisma={
 user:{...lookup,update:async()=>{state.sessionBumps++;return {}},updateMany:async()=>{state.sessionBumps++;return {count:1}},findMany:async()=>[{id:"ci-id",handle:"ci",email:"ci@example.invalid",isActive:true}]},
 blockchainDeposit:{...lookup},
 withdrawal:{...lookup},
 investorDepositWallet:{...lookup},
 role:{...lookup,
  findUnique:async({where})=>state.existing&&state.roleCatalog[where.key]?{id:"role-"+where.key,key:where.key}:null,
  findMany:async()=>Object.entries(state.roleCatalog).map(([key,permissionKeys])=>({id:"role-"+key,key,grants:permissionKeys.map(permissionKey=>({permission:{key:permissionKey}})),_count:{members:1}})),
  create:async({data})=>{state.roleCatalog[data.key]=[];return {id:"role-"+data.key,key:data.key}},
  count:async({where})=>where.key.in.filter(key=>Object.hasOwn(state.roleCatalog,key)).length},
 permission:{findMany:async({where})=>where.key.in.map(key=>({id:"perm-"+key,key}))},
 rolePermission:{deleteMany:async({where})=>{state.roleCatalog[where.roleId.replace("role-","")]=[];return {count:1}},createMany:async({data})=>{const key=data[0]?.roleId.replace("role-","");if(key)state.roleCatalog[key]=data.map(x=>x.permissionId.replace("perm-",""));state.roleEdits++;return {count:data.length}}},
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
