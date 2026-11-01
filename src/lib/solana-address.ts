// Solana public keys encode exactly 32 bytes in base58. Regex alone is not sufficient.
const alphabet="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function isValidSolanaAddress(value:unknown):value is string {
 if(typeof value!=="string"||value.length<32||value.length>44)return false;
 let number=0n;
 for(const char of value){
  const digit=alphabet.indexOf(char);
  if(digit<0)return false;
  number=number*58n+BigInt(digit);
 }
 let byteCount=0;
 while(number>0n){number>>=8n;byteCount++;}
 for(const char of value){if(char!=="1")break;byteCount++;}
 return byteCount===32;
}
