export function BrandMark({ className = "w-8 h-8" }: { className?: string }) {
  // An arch bridge over water: "setu" means bridge.
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#F2A007" />
      <path d="M5 19c3-9 19-9 22 0" stroke="#0E2A3B" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M9 19v-3M16 19v-5M23 19v-3" stroke="#0E2A3B" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 24c3-2 5 2 8 0s5 2 8 0 5 2 8 0" stroke="#0E2A3B" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Waves({ fill = "#F2F6F7", className = "" }: { className?: string; fill?: string }) {
  return (
    <div className={`overflow-hidden leading-[0] ${className}`} aria-hidden="true">
      <svg viewBox="0 0 2400 60" preserveAspectRatio="none" className="wave-drift w-[200%] h-8 sm:h-12" fill={fill}>
        <path d="M0 30c100 0 100-24 200-24s100 24 200 24 100-24 200-24 100 24 200 24 100-24 200-24 100 24 200 24 100-24 200-24 100 24 200 24 100-24 200-24 100 24 200 24 100-24 200-24 100 24 200 24 V60H0z" />
      </svg>
    </div>
  );
}
