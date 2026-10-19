import { redirect } from "next/navigation";

// Existing withdrawal links continue to work; the flow now lives in Wallet.
export default function WithdrawalsPage(){
  redirect("/wallet#withdraw-usdc");
}
