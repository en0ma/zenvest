import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: { default:"Zenvest | Your money. More possibilities.",template:"%s | Zenvest" }, description:"Explore Zenvest's approach to investor reporting, trade allocations and risk in short-duration Bitcoin event markets. Returns are variable; capital is at risk.", robots:{index:true,follow:true} };
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body className="antialiased">{children}</body></html>}
