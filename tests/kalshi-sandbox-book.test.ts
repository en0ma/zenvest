import test from "node:test";
import assert from "node:assert/strict";
import {quoteFromKalshiBook} from "../src/lib/kalshi-sandbox-book.ts";
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
