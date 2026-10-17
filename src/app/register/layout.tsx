import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
export default async function AuthLayout({children}:{children:React.ReactNode}){
 const session=await getServerSession(authOptions);
 if(session?.user?.id)redirect("/dashboard");
 return children;
}
