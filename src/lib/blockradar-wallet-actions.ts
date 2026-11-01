export type BlockradarCronAction = "rescan" | "sweep";
export async function requestBlockradarWalletAction(
 action:BlockradarCronAction, config:{key:string;walletId:string},
 send:typeof fetch=fetch
):Promise<void>{
 const segment=action==="rescan"?"rescan/blocks":"sweep/assets";
 // The rescan transactionHash is optional; a wallet-wide sweep needs no transactionId.
 // Never set forceSweep: repeated scheduler calls must not force a transfer.
 const response=await send(`https://api.blockradar.co/v1/wallets/${encodeURIComponent(config.walletId)}/${segment}`,{
  method:"POST",
  headers:{"x-api-key":config.key,"Content-Type":"application/json"},
  body:"{}",
  cache:"no-store",
  signal:AbortSignal.timeout(15000),
 });
 if(!response.ok)throw new Error(`Blockradar ${action} failed (HTTP ${response.status})`);
 const json:unknown=await response.json();
 if(!json||typeof json!=="object"||(json as {statusCode?:unknown}).statusCode!==200)
  throw new Error(`Blockradar ${action} returned an unexpected response`);
}
