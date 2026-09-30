"use client";

import { useState } from "react";
import Link from "next/link";
import { createReport } from "@/lib/api";
import { Report } from "@/lib/types";
import { Icon } from "@/components/Icons";
import { PageHeader } from "@/components/PageHeader";

export default function ReportIncident() {
  const [type, setType] = useState<Report["type"]>("flood");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
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
        type,
        description: description.trim(),
        location: { lat: Number(lat), lon: Number(lon) },
        ...(imageUrl.trim() ? { image_url: imageUrl.trim() } : {}),
      });
      setCreatedReport(report);
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not submit the report.");
    } finally {
      setSubmitting(false);
    }
  };

  const field = "w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none";
  const TYPES = [
    { value: "flood", icon: "flood", label: "Flood" },
    { value: "road_block", icon: "road", label: "Road blocked" },
    { value: "medical", icon: "medical", label: "Medical help" },
    { value: "other", icon: "incident", label: "Something else" },
  ];

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card p-8 max-w-md w-full animate-fade-in">
          <span className="inline-flex w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 items-center justify-center"><Icon name="check" className="w-7 h-7" /></span>
          <h1 className="font-display text-2xl font-bold text-slate-900 mt-4">Report received</h1>
          <p className="text-slate-600 mt-1">It is saved and waiting for verification. Keep this ID if you need to follow up.</p>
          <dl className="mt-5 rounded-lg bg-slate-50 border border-slate-200 divide-y divide-slate-200 text-sm">
            <div className="p-3"><dt className="text-slate-500">Report ID</dt><dd className="font-semibold text-slate-900 break-all">{createdReport?.id}</dd></div>
            <div className="p-3"><dt className="text-slate-500">Type</dt><dd className="font-semibold text-slate-900 capitalize">{type.replace(/_/g, " ")}</dd></div>
            <div className="p-3"><dt className="text-slate-500">Location</dt><dd className="font-semibold text-slate-900">{lat}, {lon}</dd></div>
          </dl>
          <Link href="/" className="mt-6 block text-center py-3 bg-ink text-white font-semibold rounded-lg hover:bg-blue-800">Back to home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="Report an incident" sub="Tell us what you see. Officials review every report." />

      <main className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
          <fieldset className="card p-5">
            <legend className="sr-only">Incident type</legend>
            <h2 className="font-semibold text-slate-900 mb-3">What is happening?</h2>
            <div role="radiogroup" aria-label="Incident type" className="grid grid-cols-2 gap-2">
              {TYPES.map((opt) => (
                <button key={opt.value} type="button" role="radio" aria-checked={type === opt.value}
                  onClick={() => setType(opt.value as Report["type"])}
                  className={`p-3 rounded-lg border-2 text-left flex items-center gap-3 ${type === opt.value ? "border-blue-600 bg-blue-50 text-blue-900" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"}`}>
                  <Icon name={opt.icon} className="w-6 h-6 shrink-0" />
                  <span className="font-semibold text-sm">{opt.label}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="card p-5">
            <label htmlFor="desc" className="block font-semibold text-slate-900 mb-2">Describe the situation</label>
            <textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} required
              placeholder="For example: water is knee-deep on the main road and rising." className={`${field} resize-none`} />
          </div>

          <div className="card p-5">
            <h2 className="font-semibold text-slate-900 mb-3">Where is it?</h2>
            <button type="button" onClick={getLocation} disabled={gettingLocation}
              className="w-full mb-3 py-3 border-2 border-dashed border-blue-300 bg-blue-50 text-blue-800 font-semibold rounded-lg hover:bg-blue-100 disabled:opacity-50">
              {gettingLocation ? "Finding your location…" : lat ? `Location set: ${lat}, ${lon}` : "Use my current location"}
            </button>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="lat" className="block text-sm text-slate-600 mb-1">Latitude</label>
                <input id="lat" type="number" value={lat} onChange={(e) => setLat(e.target.value)} min="-90" max="90" step="any" required className={field} />
              </div>
              <div>
                <label htmlFor="lon" className="block text-sm text-slate-600 mb-1">Longitude</label>
                <input id="lon" type="number" value={lon} onChange={(e) => setLon(e.target.value)} min="-180" max="180" step="any" required className={field} />
              </div>
            </div>
            {locationMessage && <p role="status" className="text-sm text-amber-800 mt-2">{locationMessage}</p>}
          </div>

          <div className="card p-5">
            <label htmlFor="imageUrl" className="block font-semibold text-slate-900 mb-2">Photo / Video URL</label>
            <input
              id="imageUrl"
              type="url"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="Optional link to an already hosted image"
              className={field}
            />
            <p className="text-sm text-slate-500 mt-2">File upload storage is not connected yet; you can add an image URL.</p>
          </div>

          {submitError && <p role="alert" className="p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-800">{submitError}</p>}
          <button type="submit" disabled={submitting || !description.trim() || !lat || !lon}
            className="w-full py-3.5 bg-alarm text-white font-bold rounded-lg hover:brightness-110 disabled:opacity-50">
            {submitting ? "Sending…" : "Send report"}
          </button>
        </form>
      </main>
    </div>
  );
}
