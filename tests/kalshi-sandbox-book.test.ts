import test from "node:test";
import assert from "node:assert/strict";
import {quoteFromKalshiBook,readKalshiSandboxBook} from "../src/lib/kalshi-sandbox-book.ts";
const book={yes:[["0.40","10"],["0.35","10"]],no:[["0.55","3"],["0.54","5"]]};
test("YES buy walks implied asks from NO bids without using floating prices",()=>{
 const q=quoteFromKalshiBook(book,"yes","buy",5);
 assert.equal(q.notionalMicros,2270000n);
 assert.equal(q.priceMicros,454000n);
 assert.deepEqual(q.levels,[{price:"450000",quantity:3},{price:"460000",quantity:2}]);
});
test("UP/YES sale hits YES bids, not the inverse side",()=>{
 const q=quoteFromKalshiBook(book,"yes","sell",4);
 assert.equal(q.notionalMicros,1600000n);
});
test("rejects missing liquidity, fractional contracts and large slippage",()=>{
 assert.throws(()=>quoteFromKalshiBook(book,"no","buy",21),/INSUFFICIENT/);
 assert.throws(()=>quoteFromKalshiBook({yes:[["0.01","1"]],no:[["0.99","1"]]},"yes","buy",2),/INSUFFICIENT/);
 assert.throws(()=>quoteFromKalshiBook({yes:[["0.6","1"]],no:[["0.5","1"],["0.1","2"]]},"yes","buy",2),/SLIPPAGE/);
 assert.throws(()=>quoteFromKalshiBook({yes:[["0.4","0.5"]],no:[]},"yes","sell",1),/FRACTIONAL/);
});

test("rejects invalid or empty books without manufacturing market liquidity",()=>{
 assert.throws(()=>quoteFromKalshiBook(null,"yes","buy",1),/INVALID_BOOK/);
 assert.throws(()=>quoteFromKalshiBook({yes:[],no:[]},"yes","buy",1),/NO_LIQUIDITY/);
 assert.throws(()=>quoteFromKalshiBook({yes:[["1.5","1"]],no:[]},"yes","sell",1),/INVALID_BOOK_PRICE/);
 assert.throws(()=>quoteFromKalshiBook({yes:[["0.4","-1"]],no:[]},"yes","sell",1),/FRACTIONAL_BOOK_VOLUME/);
 assert.throws(()=>quoteFromKalshiBook({yes:[["0.4","1"]],no:[]},"yes","sell",0),/INVALID_QUANTITY/);
 assert.throws(()=>quoteFromKalshiBook({yes:[["0.4","1"]],no:[]},"yes","sell",1000001),/INVALID_QUANTITY/);
 const no=quoteFromKalshiBook({yes:[["0.8","10"]],no:[["0.1","10"]]},"no","buy",3);
 assert.equal(no.notionalMicros,600000n);
 const noSell=quoteFromKalshiBook({yes:[["0.8","10"]],no:[["0.1","10"]]},"no","sell",3);
 assert.equal(noSell.notionalMicros,300000n);
});

test("read-only venue adapter rejects malformed tickers before fetching",async()=>{
 const old=globalThis.fetch;
 globalThis.fetch=async()=>{throw Error("must not call network")};
 try{
  await assert.rejects(readKalshiSandboxBook("../bad","KXBTC"),/INVALID_MARKET_TICKER/);
  await assert.rejects(readKalshiSandboxBook("","KXBTC"),/INVALID_MARKET_TICKER/);
 }finally{globalThis.fetch=old}
});
test("read-only venue adapter enforces market identity, status, series and bid book shape",async()=>{
 const old=globalThis.fetch;
 const ticker="KXBTC-TEST",series="KXBTC";
 const cases=[
  {marketStatus:503,bookStatus:200,code:"KALSHI_BOOK_UNAVAILABLE"},
  {marketStatus:200,bookStatus:429,code:"KALSHI_BOOK_UNAVAILABLE"},
  {market:null,code:"MARKET_NOT_OPEN"},
  {market:{ticker:"WRONG",series_ticker:series,status:"active"},code:"MARKET_NOT_OPEN"},
  {market:{ticker,series_ticker:series,status:"closed"},code:"MARKET_NOT_OPEN"},
  {market:{ticker,series_ticker:"OTHER",event_ticker:"OTHER",status:"open"},code:"MARKET_SERIES_MISMATCH"},
  {book:{orderbook_fp:{yes_dollars:[],no_dollars:null}},code:"UNSUPPORTED_KALSHI_BOOK"},
  {book:{orderbook_fp:{no_dollars:[]}},code:"UNSUPPORTED_KALSHI_BOOK"},
  {book:{},code:"UNSUPPORTED_KALSHI_BOOK"}
 ];
 try{
  for(const sample of cases){
   globalThis.fetch=async(input)=>{
    const isBook=String(input).includes("/orderbook");
    const status=isBook?(sample.bookStatus??200):(sample.marketStatus??200);
    const value=isBook?(sample.book??{orderbook_fp:{yes_dollars:[],no_dollars:[]}}):
     {market:sample.market===undefined?{ticker,series_ticker:series,status:"open"}:sample.market};
    return Response.json(value,{status});
   };
   await assert.rejects(readKalshiSandboxBook(ticker,series),new RegExp(sample.code));
  }
  globalThis.fetch=async(input)=>Response.json(String(input).includes("/orderbook")?
   {orderbook:{yes_dollars:[["0.4","3"]],no_dollars:[["0.5","4"]]}}:
   {market:{ticker,event_ticker:series,status:"active"}});
  const legacy=await readKalshiSandboxBook(ticker,series);
  assert.ok(legacy.observedAt instanceof Date);
  assert.deepEqual(legacy.book,{yes:[["0.4","3"]],no:[["0.5","4"]]});
  globalThis.fetch=async(input)=>Response.json(String(input).includes("/orderbook")?
   {orderbook_fp:{yes_dollars:[],no_dollars:[]}}:
   {market:{ticker,series_ticker:series,status:"open"}});
  const decimal=await readKalshiSandboxBook(ticker,series);
  assert.deepEqual(decimal.book,{yes:[],no:[]});
 }finally{globalThis.fetch=old}
});
