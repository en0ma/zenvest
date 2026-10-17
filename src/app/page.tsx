import Link from "next/link";
export default function Home() {
 return <main className="min-h-screen bg-forest text-white px-6 py-12">
  <div className="mx-auto max-w-6xl"><header className="flex justify-between items-center"><strong className="text-3xl text-mint">zenvest.</strong><span className="rounded-full border border-white/20 px-4 py-2 text-xs">DEVELOPMENT PREVIEW</span></header>
  <section className="py-28 max-w-3xl"><p className="text-mint uppercase tracking-[.24em] text-sm mb-5">Transparent capital. Clear reporting.</p>
   <h1 className="text-5xl sm:text-7xl font-semibold tracking-tight leading-[1.06]">Investing, with every naira accounted for.</h1>
   <p className="text-white/70 text-lg mt-7 max-w-xl">Explore how Zenvest will display allocated capital, available funds and trade-level performance. All data is simulated.</p>
   <div className="flex gap-3 mt-10 flex-wrap"><Link className="bg-mint text-forest rounded-xl px-6 py-4 font-semibold" href="/preview/investor">Investor preview →</Link><Link className="border border-white/25 rounded-xl px-6 py-4" href="/preview/admin">Admin preview</Link></div>
  </section><p className="text-white/50 text-xs">No live investment services or deposits are available.</p></div>
 </main>;
}
