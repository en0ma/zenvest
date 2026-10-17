import { ConfirmLink } from "@/components/account-action";
export default async function Page({searchParams}:{searchParams:Promise<{token?:string}>}){const {token}=await searchParams;return <ConfirmLink purpose="VERIFY_EMAIL" token={token??""}/>}
