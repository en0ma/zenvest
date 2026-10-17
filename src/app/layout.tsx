import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Zenvest | Investment dashboard", description: "Zenvest investor and administration prototype" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className="antialiased">{children}</body></html>;
}
