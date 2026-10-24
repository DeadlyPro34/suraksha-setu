"use client";

import { useCallback, useEffect, useState } from "react";
import { getWeather } from "@/lib/api";
import { WeatherSnapshot } from "@/lib/types";

const AHMEDABAD = { lat: 23.0, lon: 72.6 };

export function WeatherWatch({ location }: { location?: { lat: number; lon: number } | null }) {
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [gps, setGps] = useState<{ lat: number; lon: number } | null>(null);
  const point = location ?? gps ?? AHMEDABAD;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setWeather(await getWeather(point.lat, point.lon));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Weather information is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }, [point.lat, point.lon]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 10 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const useLocation = () => {
    if (!navigator.geolocation) { setError("Location is not available in this browser."); return; }
    setLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => { setGps({ lat: position.coords.latitude, lon: position.coords.longitude }); setLoading(false); },
      () => { setError("Could not access your location. Showing Ahmedabad city weather instead."); setLoading(false); },
      { timeout: 10000, maximumAge: 600000 },
    );
  };

  const rainChance = weather?.forecast.slice(0, 1).reduce((max, item) => Math.max(max, item.precipitation_probability), 0);

  return (
    <section aria-labelledby="weather-heading" className="card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-4 sm:p-5">
        <div>
          <h2 id="weather-heading" className="font-display text-lg font-bold">Weather & rain watch</h2>
          <p className="mt-1 text-sm text-slate-500">{location ? "Using your selected location" : gps ? "Using your device location" : "Approximate Ahmedabad city center"} · OpenWeather</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!location && <button type="button" onClick={useLocation} disabled={loading} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">Use my location</button>}
          <button type="button" onClick={() => void refresh()} disabled={loading} className="rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{loading ? "Updating…" : "Refresh weather"}</button>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {error && <p role="status" className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{error}</p>}
        {!weather && !error && <p role="status" className="text-sm text-slate-600">{loading ? "Loading current weather…" : "Weather has not loaded yet."}</p>}
        {weather && <>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Current</p><p className="mt-1 text-xl font-bold text-slate-900">{weather.current.temperature_c == null ? "—" : `${Math.round(weather.current.temperature_c)}°C`}</p><p className="text-sm capitalize text-slate-600">{weather.current.condition}</p></div>
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Feels like</p><p className="mt-1 text-xl font-bold text-slate-900">{weather.current.feels_like_c == null ? "—" : `${Math.round(weather.current.feels_like_c)}°C`}</p><p className="text-sm text-slate-600">Humidity {weather.current.humidity_pct ?? "—"}%</p></div>
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Wind</p><p className="mt-1 text-xl font-bold text-slate-900">{weather.current.wind_speed_m_s == null ? "—" : `${weather.current.wind_speed_m_s.toFixed(1)} m/s`}</p><p className="text-sm text-slate-600">Current conditions</p></div>
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Rain outlook</p><p className="mt-1 text-xl font-bold text-slate-900">{rainChance == null ? "—" : `${Math.round(rainChance)}%`}</p><p className="text-sm text-slate-600">Next-hour chance · peak intensity {weather.current.next_hour_peak_rain_rate_mm_h.toFixed(1)} mm/h</p></div>
          </div>

          {weather.forecast.length > 0 && <div className="mt-4"><h3 className="text-sm font-semibold text-slate-800">Hourly outlook</h3><div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">{weather.forecast.slice(0, 6).map((item, index) => <div key={`${item.time}-${index}`} className="rounded-lg border border-slate-100 p-2 text-center"><p className="text-xs text-slate-500">{item.time ? new Date(item.time).toLocaleTimeString([], { hour: "numeric" }) : `+${index}h`}</p><p className="mt-1 font-semibold text-slate-900">{Math.round(item.precipitation_probability)}% rain</p><p className="text-xs text-slate-500">{item.rain_rate_mm_h == null ? "—" : `${item.rain_rate_mm_h.toFixed(1)} mm/h`}</p></div>)}</div></div>}

          {weather.alerts.length > 0 ? <div className="mt-4 space-y-2">{weather.alerts.map((alert, index) => <article key={`${alert.event}-${index}`} className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950">
            <h3 className="font-bold">Official weather alert: {alert.event || "Weather hazard"}</h3><p className="mt-1 text-xs">From {alert.sender}{alert.ends_at ? ` · until ${new Date(alert.ends_at).toLocaleString()}` : ""}</p>{alert.description && <p className="mt-2 whitespace-pre-line text-sm">{alert.description}</p>}
          </article>)}</div> : weather.alerts_data_available ? <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">No official weather alerts were returned for this area at the time checked.</p> : <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Official weather alert details could not be loaded; check your local meteorological service.</p>}

          <p className="mt-3 text-xs text-slate-500">Weather is an advisory and may be delayed or unavailable. Forecasts do not confirm local flooding or road safety. Issued {new Date(weather.retrieved_at).toLocaleString()} · rounded area {weather.latitude.toFixed(1)}, {weather.longitude.toFixed(1)}.</p>
        </>}
      </div>
    </section>
  );
}
