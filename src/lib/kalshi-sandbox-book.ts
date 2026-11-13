/** Read-only venue book adapter. No orders, withdrawals or investor assets.
 * Bid-only YES/NO books are inverted to derive marketable ask prices.
 * All prices are exact integer USDC micros to avoid float rounding. */
type Side="yes"|"no";
export type Level={priceMicros:bigint;quantity:number};
export type SandboxQuote={notionalMicros:bigint;priceMicros:bigint;bestPriceMicros:bigint;worstPriceMicros:bigint;levels:{price:string;quantity:number}[]};
function micros(value:unknown):bigint{
 if(typeof value!=="string"||!/^(?:0|1)(?:\.\d{1,6})?$/.test(value))throw Error("INVALID_BOOK_PRICE");
 const [a,b=""]=value.split(".");
 const result=BigInt(a)*1000000n+BigInt(b.padEnd(6,"0"));
 if(result<=0n||result>=1000000n)throw Error("INVALID_BOOK_PRICE");
 return result;
}
function sideLevels(book:unknown,side:Side):Level[]{
 if(!book||typeof book!=="object")throw Error("INVALID_BOOK");
 const data=(book as Record<string,unknown>)[side];
 if(!Array.isArray(data)||data.length>100)throw Error("INVALID_BOOK");
 return data.map(x=>{
  if(!Array.isArray(x)||x.length<2)throw Error("INVALID_BOOK");
  const raw=x[1];
  if((typeof raw!=="string"&&typeof raw!=="number")||!/^[0-9]+(?:\.0+)?$/.test(String(raw)))throw Error("FRACTIONAL_BOOK_VOLUME");
  const qty=Number(raw);
  if(!Number.isSafeInteger(qty)||qty<0)throw Error("INVALID_BOOK_VOLUME");
  return {priceMicros:micros(x[0]),quantity:qty};
 }).filter(x=>x.quantity>0);
}
export function quoteFromKalshiBook(book:unknown,side:Side,orderType:"buy"|"sell",quantity:number):SandboxQuote{
 if(!Number.isSafeInteger(quantity)||quantity<=0||quantity>1000000)throw Error("INVALID_QUANTITY");
 const contra:Side=side==="yes"?"no":"yes";
 const bids=sideLevels(book,orderType==="buy"?contra:side);
 const levels=bids.map(x=>({quantity:x.quantity,priceMicros:orderType==="buy"?1000000n-x.priceMicros:x.priceMicros}))
 .sort((a,b)=>orderType==="buy"?Number(a.priceMicros-b.priceMicros):Number(b.priceMicros-a.priceMicros));
 if(!levels.length)throw Error("NO_LIQUIDITY");
 let left=quantity,notional=0n;const consumed:{price:string;quantity:number}[]=[];
 for(const level of levels){
  const take=Math.min(left,level.quantity);if(!take)continue;
  notional+=BigInt(take)*level.priceMicros;left-=take;
  consumed.push({price:level.priceMicros.toString(),quantity:take});
  if(left===0)break;
 }
 if(left)throw Error("INSUFFICIENT_BOOK_LIQUIDITY");
 const best=levels[0].priceMicros,worst=BigInt(consumed[consumed.length-1].price);
 // Reject a book sweep more than 5 percentage points away from the best offer.
 if(orderType==="buy" ? worst-best>50000n : best-worst>50000n)throw Error("EXCESSIVE_SLIPPAGE");
 return {notionalMicros:notional,priceMicros:notional/BigInt(quantity),
  bestPriceMicros:best,worstPriceMicros:worst,levels:consumed};
}
export async function readKalshiSandboxBook(ticker:string,expectedSeries:string):Promise<{book:unknown;market:Record<string,unknown>;observedAt:Date}>{
 if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$/.test(ticker))throw Error("INVALID_MARKET_TICKER");
 const base="https://external-api.kalshi.com/trade-api/v2";
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),5000);
 try{
  const [marketResponse,bookResponse]=await Promise.all([
   fetch(base+"/markets/"+encodeURIComponent(ticker),{signal:controller.signal,cache:"no-store"}),
   fetch(base+"/markets/"+encodeURIComponent(ticker)+"/orderbook?depth=100",{signal:controller.signal,cache:"no-store"})
  ]);
  if(!marketResponse.ok||!bookResponse.ok)throw Error("KALSHI_BOOK_UNAVAILABLE");
  const marketData=await marketResponse.json() as Record<string,unknown>;
  const orderData=await bookResponse.json() as Record<string,unknown>;
  const market=marketData.market as Record<string,unknown>|undefined;
  if(!market||market.ticker!==ticker||!["active","open"].includes(String(market.status)))throw Error("MARKET_NOT_OPEN");
  if(market.series_ticker!==expectedSeries&&market.event_ticker!==expectedSeries)
   throw Error("MARKET_SERIES_MISMATCH");
  const fp=orderData.orderbook_fp as Record<string,unknown>|undefined;
  const legacy=orderData.orderbook as Record<string,unknown>|undefined;
  const data=fp??legacy;
  if(!data||!Array.isArray(data.yes_dollars)||!Array.isArray(data.no_dollars))throw Error("UNSUPPORTED_KALSHI_BOOK");
  return {book:{yes:data.yes_dollars,no:data.no_dollars},market,observedAt:new Date()};
 }finally{clearTimeout(timer)}
}
