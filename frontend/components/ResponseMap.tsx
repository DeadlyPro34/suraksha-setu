"use client";

import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { Alert, Shelter } from "@/lib/types";

const alertColors: Record<string, string> = {
  evacuation: "#dc2626",
  warning: "#ea580c",
  resupply: "#2563eb",
  all_clear: "#16a34a",
};

function markerIcon(color: string, kind: "alert" | "shelter") {
  const shape = kind === "shelter" ? "⌂" : "!";
  return L.divIcon({
    className: "response-map-marker",
    html: `<span style="background:${color}"><i>${shape}</i></span>`,
    iconSize: [34, 40],
    iconAnchor: [17, 38],
    popupAnchor: [0, -34],
  });
}

function FitMarkers({ points }: { points: Array<[number, number]> }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points, { padding: [36, 36], maxZoom: 13 });
    else if (points.length === 1) map.setView(points[0], 12);
  }, [map, points]);
  return null;
}

export function ResponseMap({ alerts, shelters, showAlerts, showShelters }: {
  alerts: Alert[];
  shelters: Shelter[];
  showAlerts: boolean;
  showShelters: boolean;
}) {
  const alertPoints = alerts.filter((alert) => showAlerts && alert.lat != null && alert.lon != null)
    .map((alert) => [alert.lat as number, alert.lon as number] as [number, number]);
  const shelterPoints = shelters.filter((shelter) => showShelters)
    .map((shelter) => [shelter.lat, shelter.lon] as [number, number]);
  const points = [...alertPoints, ...shelterPoints];
  const center: [number, number] = points[0] || [23.0225, 72.5714];

  return <MapContainer center={center} zoom={11} scrollWheelZoom className="h-full min-h-[440px] w-full rounded-xl">
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
    />
    <FitMarkers points={points} />
    {showShelters && shelters.map((shelter) => <Marker key={`shelter-${shelter.id}`} position={[shelter.lat, shelter.lon]} icon={markerIcon(shelter.status === "open" ? "#0f9f6e" : shelter.status === "full" ? "#d97706" : "#64748b", "shelter")}>
      <Popup><div className="min-w-48"><strong>{shelter.name}</strong><p className="mt-1 capitalize">{shelter.status} · {shelter.available_capacity} spaces available</p><p className="text-xs">{shelter.available_percentage}% capacity available</p>{shelter.has_medical && <span className="mr-2 text-xs">Medical support</span>}{shelter.has_electricity && <span className="text-xs">Electricity</span>}</div></Popup>
    </Marker>)}
    {showAlerts && alerts.filter((alert) => alert.lat != null && alert.lon != null).map((alert) => <Marker key={`alert-${alert.id}`} position={[alert.lat as number, alert.lon as number]} icon={markerIcon(alertColors[alert.type] || "#dc2626", "alert")}>
      <Popup><div className="min-w-48"><strong className="capitalize">{alert.type.replace(/_/g, " ")} alert</strong><p className="mt-1">{alert.message}</p><p className="mt-1 text-xs text-slate-500">{alert.sent_at ? new Date(alert.sent_at).toLocaleString() : "Not sent yet"}</p></div></Popup>
    </Marker>)}
  </MapContainer>;
}
