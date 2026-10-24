import { Shelter } from "@/lib/types";

export function ShelterFreshness({ updatedAt }: { updatedAt?: Shelter["updated_at"] }) {
  if (!updatedAt) return <p className="mt-2 text-xs text-amber-800">Availability update time not recorded. Please confirm before travelling.</p>;
  const parsed = new Date(updatedAt);
  if (Number.isNaN(parsed.getTime())) return <p className="mt-2 text-xs text-amber-800">Availability update time unavailable. Please confirm before travelling.</p>;
  return <p className="mt-2 text-xs text-slate-500">Availability last updated <time dateTime={parsed.toISOString()}>{parsed.toLocaleString()}</time></p>;
}
