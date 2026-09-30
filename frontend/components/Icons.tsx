const PATHS: Record<string, JSX.Element> = {
  dashboard: <><rect x="3" y="3" width="8" height="10" rx="1.5" /><rect x="13" y="3" width="8" height="6" rx="1.5" /><rect x="13" y="11" width="8" height="10" rx="1.5" /><rect x="3" y="15" width="8" height="6" rx="1.5" /></>,
  incident: <><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 10v4M12 17.2v.1" /></>,
  check: <><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.8 2.8L16 9.5" /></>,
  shelter: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v10h13V10M10 20v-5h4v5" /></>,
  team: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.4 2.7-6 6-6s6 2.6 6 6" /><circle cx="17" cy="9" r="2.4" /><path d="M17 14c2.5 0 4 1.9 4 4.5" /></>,
  box: <><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9Z" /><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" /></>,
  map: <><path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2V6Z" /><path d="M9 4v14M15 6v14" /></>,
  flood: <path d="M3 9c2-2 4 2 6 0s4 2 6 0 4 2 6 0M3 15c2-2 4 2 6 0s4 2 6 0 4 2 6 0" />,
  road: <path d="M8 3 4 21M16 3l4 18M12 4v3M12 11v3M12 18v3" />,
  medical: <><rect x="3.5" y="3.5" width="17" height="17" rx="3" /><path d="M12 8v8M8 12h8" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  bot: <><rect x="4" y="8" width="16" height="11" rx="3" /><path d="M12 4v4M9 13v1.5M15 13v1.5" /></>,
  weather: <path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6 11.5 3.3 3.3 0 0 0 7 18Z" />,
};

export function Icon({ name, className = "w-6 h-6" }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name] ?? PATHS.bot}
    </svg>
  );
}
