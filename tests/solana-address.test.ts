import test from "node:test";
import assert from "node:assert/strict";
import {isValidSolanaAddress} from "../src/lib/solana-address.ts";

test("Solana address validation requires exactly 32 decoded public-key bytes",()=>{
 assert.equal(isValidSolanaAddress("11111111111111111111111111111111"),true);
 assert.equal(isValidSolanaAddress("So11111111111111111111111111111111111111112"),true);
 assert.equal(isValidSolanaAddress("1111111111111111111111111111111"),false);
 assert.equal(isValidSolanaAddress("111111111111111111111111111111111"),false);
 assert.equal(isValidSolanaAddress("0x" + "a".repeat(40)),false);
 assert.equal(isValidSolanaAddress("O".repeat(40)),false);
 assert.equal(isValidSolanaAddress("z".repeat(44)),false);
 assert.equal(isValidSolanaAddress(null),false);
 assert.equal(isValidSolanaAddress({}),false);
});
