import test from "node:test";
import assert from "node:assert/strict";
import {strategyConfiguration,eventTradeInput,canRecordBotTrade} from "../src/lib/bot-strategy-api-schema.ts";
test("v1 supports only Kalshi event strategy configuration",()=>{
 const valid={market_type:"event",venue:"kalshi",side:"yes",asset:"BTC-15min"};
 assert.equal(strategyConfiguration.safeParse(valid).success,true);
 assert.equal(strategyConfiguration.safeParse({...valid,side:"up"}).success,true);
 assert.equal(strategyConfiguration.safeParse({...valid,market_type:"spot"}).success,false);
 assert.equal(strategyConfiguration.safeParse({...valid,venue:"other"}).success,false);
 assert.equal(strategyConfiguration.safeParse({...valid,asset:"../foo"}).success,false);
 assert.equal(strategyConfiguration.safeParse({...valid,isActive:true}).success,false);
});
test("event trade requests have bounded contract sizes and required event ids",()=>{
 const valid={order_type:"buy",trade_size:5,event_id:"BTC-15min-123",side:"yes"};
 assert.equal(eventTradeInput.safeParse(valid).success,true);
 assert.equal(eventTradeInput.safeParse({...valid,order_type:"sell",side:"down"}).success,true);
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
