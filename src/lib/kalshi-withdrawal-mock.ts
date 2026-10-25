/** Simulation adapter only. It must never be interpreted as proof of a Kalshi withdrawal.
 * Production integration must replace this with authenticated Kalshi transport.
 */
export type KalshiWithdrawalSubmission={status:number;withdrawalId:string;mocked:true};
export async function submitMockKalshiWithdrawal(input:{eventId:string;amountUsdcMicros:bigint;destination:string}):Promise<KalshiWithdrawalSubmission>{
 if(process.env.NODE_ENV!=="test")throw new Error("Mock Kalshi withdrawals are restricted to tests");
 if(!input.eventId||input.amountUsdcMicros<=0n||!input.destination)throw new Error("Invalid simulated withdrawal");
 return {status:200,withdrawalId:"mock-withdrawal:"+input.eventId,mocked:true};
}
