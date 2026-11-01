import { redirect } from "next/navigation";

// Funding, deposit address and confirmed history live together in Wallet.
export default function Deposits() {
  redirect("/wallet");
}
