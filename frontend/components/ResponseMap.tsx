"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { Alert, Dispatch, Shelter, VolunteerLocation, VolunteerSafetyEvent } from "@/lib/types";

const alertColors: Record<string, string> = {
  evacuation: "#dc2626",
  warning: "#ea580c",
  resupply: "#2563eb",
  all_clear: "#16a34a",
};

function markerIcon(color: string, kind: "alert" | "shelter" | "volunteer" | "task" | "sos") {
  const shape = kind === "shelter" ? "⌂" : kind === "volunteer" ? "●" : kind === "task" ? "+" : kind === "sos" ? "SOS" : "!";
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
  const hasFitInitialData = useRef(false);
  useEffect(() => {
    if (hasFitInitialData.current || points.length === 0) return;
    if (points.length > 1) map.fitBounds(points, { padding: [36, 36], maxZoom: 13 });
    else if (points.length === 1) map.setView(points[0], 12);
    hasFitInitialData.current = true;
  }, [map, points]);
  return null;
}

function FitRoute({ points }: { points: Array<[number, number]> }) {
  const map = useMap();
  const fittedRouteKey = useRef("");
  const routeKey = points.length ? `${points.length}:${points[0].join(",")}:${points[points.length - 1].join(",")}` : "";
  useEffect(() => {
    if (points.length > 1 && routeKey !== fittedRouteKey.current) {
      fittedRouteKey.current = routeKey;
      map.fitBounds(points, { padding: [40, 40], maxZoom: 14 });
    }
  }, [map, points, routeKey]);
  return null;
}

function FollowPosition({ position, follow }: { position: [number, number] | null; follow: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (follow && position) map.setView(position, Math.max(map.getZoom(), 15), { animate: true });
  }, [follow, map, position]);
  return null;
}

function FocusLocation({ position }: { position: { lat: number; lon: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo([position.lat, position.lon], Math.max(map.getZoom(), 14), { animate: true });
  }, [map, position]);
  return null;
}

function InvalidateSizeOnResize() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(container);
    map.invalidateSize({ pan: false });
    return () => observer.disconnect();
  }, [map]);
  return null;
}

function MapClickCapture({ onPick }: { onPick?: (lat: number, lon: number) => void }) {
  useMapEvents({ click: (event) => onPick?.(event.latlng.lat, event.latlng.lng) });
  return null;
}

export function ResponseMap({ alerts, shelters, showAlerts, showShelters, volunteerLocations = [], showVolunteers = false, taskLocations = [], showTasks = false, safetyEvents = [], showSafetyEvents = false, onLocationSelect, selectedLocation, focusLocation, routeCoordinates = [], currentPosition = null, followPosition = false }: {
  alerts: Alert[];
  shelters: Shelter[];
  showAlerts: boolean;
  showShelters: boolean;
  volunteerLocations?: VolunteerLocation[];
  showVolunteers?: boolean;
  taskLocations?: Dispatch[];
  showTasks?: boolean;
  safetyEvents?: VolunteerSafetyEvent[];
  showSafetyEvents?: boolean;
  onLocationSelect?: (lat: number, lon: number) => void;
  selectedLocation?: { lat: number; lon: number } | null;
  focusLocation?: { lat: number; lon: number } | null;
  routeCoordinates?: Array<[number, number]>;
  currentPosition?: [number, number] | null;
  followPosition?: boolean;
}) {
  const isValidPoint = (lat: number, lon: number) => Number.isFinite(lat) && Number.isFinite(lon) && !(lat === 0 && lon === 0);
  const alertPoints = alerts.filter((alert) => showAlerts && alert.lat != null && alert.lon != null && isValidPoint(alert.lat, alert.lon))
    .map((alert) => [alert.lat as number, alert.lon as number] as [number, number]);
  const shelterPoints = shelters.filter((shelter) => showShelters && isValidPoint(shelter.lat, shelter.lon))
    .map((shelter) => [shelter.lat, shelter.lon] as [number, number]);
  const volunteerPoints = volunteerLocations.filter((volunteer) => showVolunteers && isValidPoint(volunteer.lat, volunteer.lon))
    .map((volunteer) => [volunteer.lat, volunteer.lon] as [number, number]);
  const taskPoints = taskLocations.filter((task) => showTasks && task.status !== "completed" && task.lat != null && task.lon != null && isValidPoint(task.lat, task.lon))
    .map((task) => [task.lat as number, task.lon as number] as [number, number]);
  const safetyPoints = safetyEvents.filter((event) => showSafetyEvents && event.lat != null && event.lon != null && isValidPoint(event.lat, event.lon))
    .map((event) => [event.lat as number, event.lon as number] as [number, number]);
  const points = [...alertPoints, ...shelterPoints, ...volunteerPoints, ...taskPoints, ...safetyPoints, ...(selectedLocation ? [[selectedLocation.lat, selectedLocation.lon] as [number, number]] : []), ...(focusLocation ? [[focusLocation.lat, focusLocation.lon] as [number, number]] : [])];
  const center: [number, number] = focusLocation ? [focusLocation.lat, focusLocation.lon] : selectedLocation ? [selectedLocation.lat, selectedLocation.lon] : points[0] || [23.0225, 72.5714];

  return <MapContainer key="leaflet-response-map" center={center} zoom={11} scrollWheelZoom className="h-full min-h-0 w-full rounded-xl">
    <InvalidateSizeOnResize />
    <FitRoute points={routeCoordinates} />
    <FollowPosition position={currentPosition} follow={followPosition} />
    <FocusLocation position={focusLocation || null} />
    {onLocationSelect && <MapClickCapture onPick={onLocationSelect} />}
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      updateWhenZooming={false}
      updateWhenIdle={true}
      keepBuffer={3}
    />
    {routeCoordinates.length > 1 && <>
      <Polyline positions={routeCoordinates} pathOptions={{ color: "#ffffff", weight: 9, opacity: 0.9 }} />
      <Polyline positions={routeCoordinates} pathOptions={{ color: "#075985", weight: 5, opacity: 0.95 }} />
      <Marker position={routeCoordinates[0]} icon={markerIcon("#075985", "task")}><Popup>Route starts here</Popup></Marker>
      <Marker position={routeCoordinates[routeCoordinates.length - 1]} icon={markerIcon("#0f9f6e", "shelter")}><Popup>Selected shelter</Popup></Marker>
    </>}
    {currentPosition && <CircleMarker center={currentPosition} radius={9} pathOptions={{ color: "white", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }}><Popup>Your current location</Popup></CircleMarker>}
    <FitMarkers points={points} />
    {selectedLocation && <Marker position={[selectedLocation.lat, selectedLocation.lon]} icon={markerIcon("#0e7490", "shelter")}><Popup>Selected shelter location</Popup></Marker>}
    {focusLocation && <Marker position={[focusLocation.lat, focusLocation.lon]} icon={markerIcon("#0e7490", "task")}><Popup>Selected location</Popup></Marker>}
    {showShelters && shelters.filter((shelter) => isValidPoint(shelter.lat, shelter.lon)).map((shelter) => <Marker key={`shelter-${shelter.id}`} position={[shelter.lat, shelter.lon]} icon={markerIcon(shelter.status === "open" ? "#0f9f6e" : shelter.status === "full" ? "#d97706" : "#64748b", "shelter")}>
      <Popup><div className="min-w-48"><strong>{shelter.name}</strong><p className="mt-1 capitalize">{shelter.status} · {shelter.available_capacity} spaces available</p><p className="text-xs">{shelter.available_percentage}% capacity available</p><p className="mt-1 text-xs text-slate-500">{shelter.updated_at ? `Availability updated ${new Date(shelter.updated_at).toLocaleString()}` : "Availability update time not recorded"}</p>{shelter.has_medical && <span className="mr-2 text-xs">Medical support</span>}{shelter.has_electricity && <span className="text-xs">Electricity</span>}</div></Popup>
    </Marker>)}
    {showAlerts && alerts.filter((alert) => alert.lat != null && alert.lon != null && isValidPoint(alert.lat, alert.lon)).map((alert) => <Marker key={`alert-${alert.id}`} position={[alert.lat as number, alert.lon as number]} icon={markerIcon(alertColors[alert.type] || "#dc2626", "alert")}>
      <Popup><div className="min-w-48"><strong className="capitalize">{alert.type.replace(/_/g, " ")} alert</strong><p className="mt-1">{alert.message}</p><p className="mt-1 text-xs text-slate-500">{alert.sent_at ? new Date(alert.sent_at).toLocaleString() : "Not sent yet"}</p></div></Popup>
    </Marker>)}
    {showVolunteers && volunteerLocations.filter((volunteer) => isValidPoint(volunteer.lat, volunteer.lon)).map((volunteer) => <Marker key={`volunteer-${volunteer.volunteer_id}`} position={[volunteer.lat, volunteer.lon]} icon={markerIcon("#7c3aed", "volunteer")}>
      <Popup><div className="min-w-48"><strong>{volunteer.volunteer_name}</strong><p className="mt-1">{volunteer.task}</p><p className="mt-1 capitalize text-xs">Status: {volunteer.status.replace(/_/g, " ")}</p><p className="text-xs text-slate-500">Location updated {new Date(volunteer.updated_at).toLocaleTimeString()}</p></div></Popup>
    </Marker>)}
    {showTasks && taskLocations.filter((task) => task.status !== "completed" && task.lat != null && task.lon != null && isValidPoint(task.lat, task.lon)).map((task) => <Marker key={`task-${task.id}`} position={[task.lat as number, task.lon as number]} icon={markerIcon("#0891b2", "task")}>
      <Popup><div className="min-w-48"><strong>Volunteer task</strong><p className="mt-1">{task.message}</p><p className="mt-1 capitalize text-xs">Status: {task.status.replace(/_/g, " ")}</p>{task.assignee_name && <p className="text-xs">Assigned to {task.assignee_name}</p>}</div></Popup>
    </Marker>)}
    {showSafetyEvents && safetyEvents.filter((event) => event.lat != null && event.lon != null && isValidPoint(event.lat, event.lon)).map((event) => <Marker key={`safety-${event.id}`} position={[event.lat as number, event.lon as number]} icon={markerIcon(event.event_type === "sos" ? "#b91c1c" : "#d97706", "sos")}>
      <Popup><div className="min-w-48"><strong>{event.event_type === "sos" ? "Volunteer SOS" : "Missed shift check-in"}</strong><p className="mt-1">{event.volunteer_name} · {event.phone}</p><p className="mt-1">{event.task}</p><p className="mt-1 text-xs text-slate-500">Location: {event.location_source.replace(/_/g, " ")}{event.accuracy_m != null ? ` · ±${Math.round(event.accuracy_m)} m accuracy` : ""}</p><p className="mt-1 text-xs text-slate-500">{event.message}</p></div></Popup>
    </Marker>)}
  </MapContainer>;
}
