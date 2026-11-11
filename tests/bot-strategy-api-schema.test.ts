import test from "node:test";
import assert from "node:assert/strict";
import {strategyConfiguration,eventTradeInput,canRecordBotTrade,canonicalEventSide,allocationMicros} from "../src/lib/bot-strategy-api-schema.ts";
test("v1 creates only Kalshi event strategies with valid USDC allocation bounds, no side",()=>{
 const valid={market_type:"event",venue:"kalshi",asset:"BTC-15min",min_allocation:"10.5",max_allocation:"5000"};
 assert.equal(strategyConfiguration.safeParse(valid).success,true);
 assert.equal(strategyConfiguration.safeParse({...valid,strategy_id:"existing-strategy"}).success,true);
 assert.equal(strategyConfiguration.safeParse({...valid,side:"yes"}).success,false);
 assert.equal(strategyConfiguration.safeParse({...valid,market_type:"spot"}).success,false);
 assert.equal(strategyConfiguration.safeParse({...valid,venue:"other"}).success,false);
 assert.equal(strategyConfiguration.safeParse({...valid,asset:"../foo"}).success,false);
 assert.equal(strategyConfiguration.safeParse({...valid,min_allocation:"0"}).success,false);
 assert.equal(strategyConfiguration.safeParse({...valid,min_allocation:"20",max_allocation:"10"}).success,false);
 assert.equal(strategyConfiguration.safeParse({...valid,min_allocation:"0.0000001"}).success,false);
 assert.equal(strategyConfiguration.safeParse({...valid,max_allocation:"9223372036855"}).success,false);
 assert.equal(strategyConfiguration.safeParse({...valid,isActive:true}).success,false);
 assert.equal(allocationMicros("10.000001"),10000001n);
});
test("event trade requests have bounded contract sizes and canonical yes/up no/down sides",()=>{
 const valid={order_type:"buy",trade_size:5,event_id:"BTC-15min-123",side:"yes"};
 assert.equal(eventTradeInput.safeParse(valid).success,true);
 assert.equal(eventTradeInput.safeParse({...valid,order_type:"sell",side:"down"}).success,true);
 assert.equal(canonicalEventSide("yes"),"yes");
 assert.equal(canonicalEventSide("up"),"yes");
 assert.equal(canonicalEventSide("no"),"no");
 assert.equal(canonicalEventSide("down"),"no");
 assert.equal(eventTradeInput.safeParse({...valid,trade_size:0}).success,false);
 assert.equal(eventTradeInput.safeParse({...valid,trade_size:1.5}).success,false);
 assert.equal(eventTradeInput.safeParse({...valid,trade_size:1000001}).success,false);
 assert.equal(eventTradeInput.safeParse({...valid,event_id:""}).success,false);
 assert.equal(eventTradeInput.safeParse({...valid,side:"maybe"}).success,false);
 assert.equal(eventTradeInput.safeParse({...valid,settled:true}).success,false);
});
test("only configured monitoring/trading strategies admit unexecuted intents",()=>{
 for(const s of ["ONBOARDING","SHUTTING_DOWN","SHUTDOWN","OFFLINE"]){
  assert.equal(canRecordBotTrade(s,"PREDICTION","kalshi","BTC-15min"),false);
 }
 assert.equal(canRecordBotTrade("MONITORING","PREDICTION","kalshi","BTC-15min"),true);
 assert.equal(canRecordBotTrade("TRADING","PREDICTION","kalshi","BTC-15min"),true);
 assert.equal(canRecordBotTrade("TRADING","SPOT","kalshi","BTC-15min"),false);
 assert.equal(canRecordBotTrade("TRADING","PREDICTION",null,"BTC-15min"),false);
 assert.equal(canRecordBotTrade("TRADING","PREDICTION","kalshi",null),false);
});
