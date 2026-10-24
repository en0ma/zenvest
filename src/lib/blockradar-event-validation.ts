import {createHmac,timingSafeEqual} from "node:crypto";
export function validBlockradarSignature(raw:string,signature:string|null,secret:string){
 if(!signature||!/^[a-f\d]{128}$/i.test(signature)||!secret)return false;
 const provided=Buffer.from(signature,"hex");
 const expected=createHmac("sha512",secret).update(raw,"utf8").digest();
 return provided.length===expected.length&&timingSafeEqual(provided,expected);
}
export function parsePositiveUsdcMicros(raw:unknown):bigint|null {
 if(typeof raw!=="string"||!/^(0|[1-9]\d*)(\.\d{1,6})?$/.test(raw))return null;
 const [whole,fraction=""]=raw.split(".");
 const amount=BigInt(whole)*1000000n+BigInt(fraction.padEnd(6,"0"));
 return amount>0n&&amount<=9223372036854775807n?amount:null;
}
export function validSweptDeposit(data:Record<string,unknown>,mint:string,masterWalletId:string,recipient:string,amount:bigint){
 const asset=data.asset&&typeof data.asset==="object"?data.asset as Record<string,unknown>:{};
 const master=data.wallet&&typeof data.wallet==="object"?data.wallet as Record<string,unknown>:{};
 return data.confirmed===true&&data.status==="SUCCESS"&&data.type==="DEPOSIT"&&
  asset.symbol==="USDC"&&asset.address===mint&&asset.decimals===6&&
  ["devnet","testnet"].includes(String(data.network))&&master.id===masterWalletId&&
  data.assetSwept===true&&parsePositiveUsdcMicros(data.assetSweptAmount)===amount&&
  typeof data.assetSweptHash==="string"&&data.assetSweptHash.length>0&&
  data.assetSweptSenderAddress===recipient&&typeof master.address==="string"&&
  data.assetSweptRecipientAddress===master.address;
}
