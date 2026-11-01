/** Simulation adapter only. It must never be interpreted as proof of a Kalshi withdrawal.
 * HTTP 200 means mock acceptance only, never proof of funds movement.
 * Replace this stub with authenticated Kalshi transport before enabling live withdrawals.
 */
export type KalshiWithdrawalSubmission={status:number;withdrawalId:string;mocked:true};
export async function submitMockKalshiWithdrawal(input:{eventId:string;amountUsdcMicros:bigint;destination:string}):Promise<KalshiWithdrawalSubmission>{
 if(!input.eventId||input.amountUsdcMicros<=0n||!input.destination)throw new Error("Invalid simulated withdrawal");
 return {status:200,withdrawalId:"mock-withdrawal:"+input.eventId,mocked:true};
}
