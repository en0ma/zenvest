export type DepositReplayInput={
 actionStatus:string;
 operation:string;
 resource:string;
 requestedBy:string;
 decidedBy:string|null;
 depositStatus:string;
 creditedAt:Date|null;
 providerTransactionId:string|null;
 masterWalletId:string;
 expectedWalletId:string;
 walletStatus:string;
 walletProvider:string;
 walletNetwork:string;
};
export function canReplayApprovedDeposit(input:DepositReplayInput):boolean{
 return input.actionStatus==="APPROVED"&&input.resource==="deposits"&&input.operation==="reconcile"&&
  Boolean(input.decidedBy)&&input.decidedBy!==input.requestedBy&&
  input.depositStatus==="CONFIRMING"&&!input.creditedAt&&Boolean(input.providerTransactionId)&&
  Boolean(input.masterWalletId)&&input.masterWalletId===input.expectedWalletId&&
  input.walletStatus==="ACTIVE"&&input.walletProvider==="BLOCKRADAR"&&input.walletNetwork==="solana";
}
