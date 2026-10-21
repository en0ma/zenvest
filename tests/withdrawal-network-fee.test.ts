import test from "node:test";
import assert from "node:assert/strict";
import {parseBlockradarNetworkFee,withdrawalFeeBreakdown,formatMicros} from "../src/lib/withdrawal-network-fee.ts";
test("Blockradar mock response reads data.networkFeeInUSD and rounds up to USDC micros",()=>{
 assert.equal(parseBlockradarNetworkFee({data:{networkFee:"0.00005",networkFeeInUSD:"0.01234567",transactionFee:"0.00006"}}),12346n);
 assert.equal(parseBlockradarNetworkFee({data:{networkFeeInUSD:"0"}}),0n);
 assert.equal(parseBlockradarNetworkFee({data:{networkFeeInUSD:0.5}}),500000n);
 for(const v of [{data:{networkFee:"0.5"}},{data:{networkFeeInUSD:"-1"}},{data:{networkFeeInUSD:"1e-3"}},{data:{networkFeeInUSD:null}},{},null])
  assert.throws(()=>parseBlockradarNetworkFee(v));
});
test("Gross pays 2 USDC service fee plus estimated network USD fee; balance conserved",()=>{
 const network=parseBlockradarNetworkFee({data:{networkFeeInUSD:"0.03125"}});
 const fees=withdrawalFeeBreakdown(10_000_000n,network);
 assert.deepEqual(fees,{service:2_000_000n,network:31_250n,total:2_031_250n,net:7_968_750n});
 assert.equal(fees.net+fees.total,10_000_000n);
 assert.equal(formatMicros(fees.net),"7.968750");
 assert.throws(()=>withdrawalFeeBreakdown(2_031_250n,network));
 assert.throws(()=>withdrawalFeeBreakdown(10_000_000n,-1n));
});
