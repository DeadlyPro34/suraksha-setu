import Link from "next/link";
import { BrandMark } from "./Brand";

export function PageHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <header className="gradient-primary text-white">
      <div className="max-w-2xl mx-auto px-4 pt-3 pb-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-blue-100 hover:text-white">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
            Home
          </Link>
          <BrandMark className="w-7 h-7" />
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold mt-4">{title}</h1>
        {sub && <p className="text-blue-100 mt-1">{sub}</p>}
      </div>
    </header>
  );
}
