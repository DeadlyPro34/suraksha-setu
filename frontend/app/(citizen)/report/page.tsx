"use client";

import { useState } from "react";
import Link from "next/link";
import { createReport } from "@/lib/api";
import { Report } from "@/lib/types";

export default function ReportIncident() {
  const [type, setType] = useState<Report["type"]>("flood");
  const [description, setDescription] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [gettingLocation, setGettingLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [createdReport, setCreatedReport] = useState<Report | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);

  const getLocation = () => {
    setGettingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude.toFixed(6));
          setLon(pos.coords.longitude.toFixed(6));
          setLocationMessage(null);
          setGettingLocation(false);
        },
        () => {
          setLocationMessage("Could not get your location. Enter the coordinates manually.");
          setGettingLocation(false);
        }
      );
    } else {
      setLocationMessage("Location is unavailable in this browser. Enter the coordinates manually.");
      setGettingLocation(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const report = await createReport({
        reporter_id: null,
        type,
        description: description.trim(),
        lat: Number(lat),
        lon: Number(lon),
      });
      setCreatedReport(report);
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not submit the report.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="card p-8 max-w-md w-full text-center animate-fade-in">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Report Submitted</h2>
          <p className="text-slate-500 text-sm mb-6">
            Your report was saved and is pending verification. Keep this reference ID for follow-up.
          </p>
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl mb-6">
            <p className="text-xs text-blue-700 break-all">🆔 Report ID: {createdReport?.id}</p>
            <p className="text-xs text-blue-700">📍 Location: {lat}, {lon}</p>
            <p className="text-xs text-blue-700 mt-1">📝 Type: {type.replace("_", " ")}</p>
          </div>
          <Link href="/" className="inline-block px-6 py-2.5 gradient-primary text-white font-medium rounded-xl hover:opacity-90 transition-opacity">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="text-slate-400 hover:text-slate-600 transition-colors">
            ← Back
          </Link>
          <h1 className="text-lg font-bold text-slate-900">Report Incident</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-5 animate-fade-in">
          {/* Incident Type */}
          <div className="card p-5">
            <label className="block text-sm font-semibold text-slate-700 mb-3">Incident Type</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "flood", icon: "🌊", label: "Flood" },
                { value: "road_block", icon: "🚧", label: "Road Block" },
                { value: "medical", icon: "🏥", label: "Medical" },
                { value: "other", icon: "⚠️", label: "Other" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value as Report["type"])}
                  className={`p-3 rounded-xl border-2 text-left transition-all duration-200 ${
                    type === opt.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="text-xl mb-1">{opt.icon}</div>
                  <div className="text-sm font-medium text-slate-900">{opt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="card p-5">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the situation..."
              rows={4}
              required
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none transition-all"
            />
          </div>

          {/* Location */}
          <div className="card p-5">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Location</label>
            <button
              type="button"
              onClick={getLocation}
              disabled={gettingLocation}
              className="w-full mb-3 py-3 border-2 border-dashed border-blue-300 bg-blue-50 text-blue-700 font-medium rounded-xl hover:bg-blue-100 transition-all disabled:opacity-50"
            >
              {gettingLocation ? "📍 Getting location..." : lat ? `📍 ${lat}, ${lon}` : "📍 Use Current GPS Location"}
            </button>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="Latitude"
                min="-90"
                max="90"
                step="any"
                required
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              />
              <input
                type="number"
                value={lon}
                onChange={(e) => setLon(e.target.value)}
                placeholder="Longitude"
                min="-180"
                max="180"
                step="any"
                required
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              />
            </div>
            {locationMessage && <p role="status" className="text-xs text-amber-700 mt-2">{locationMessage}</p>}
          </div>

          {/* Photo uploads are not connected to storage yet. */}
          <div className="card p-5">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Photo / Video</label>
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
              <div className="text-3xl mb-2">📷</div>
              <p className="text-sm text-slate-500">Photo and video uploads are not connected yet.</p>
            </div>
          </div>

          {/* Submit */}
          {submitError && (
            <p role="alert" className="p-3 rounded-xl border border-red-200 bg-red-50 text-sm text-red-700">
              {submitError}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting || !description.trim() || !lat || !lon}
            className="w-full py-3.5 gradient-danger text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition-all duration-200 shadow-lg shadow-red-500/25"
          >
            {submitting ? "Submitting Report..." : "🚨 Submit Report"}
          </button>
        </form>
      </main>
    </div>
  );
}
