import { NextRequest, NextResponse } from "next/server";

interface OsrmStep {
  name?: string;
  distance?: number;
  maneuver?: { type?: string; modifier?: string; location?: [number, number] };
}

interface OsrmRoute {
  geometry?: { coordinates?: [number, number][] };
  distance: number;
  duration: number;
  legs?: Array<{ steps?: OsrmStep[] }>;
}

interface OsrmResponse {
  code?: string;
  routes?: OsrmRoute[];
}

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function hazardCount(route: OsrmRoute, hazards: Array<{ lat: number; lon: number }>) {
  const coordinates = route.geometry?.coordinates || [];
  return hazards.filter((hazard) => coordinates.some(([lon, lat]) => distanceMeters(lat, lon, hazard.lat, hazard.lon) <= 750)).length;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const values = ["start_lat", "start_lon", "end_lat", "end_lon"].map((key) => Number(params.get(key)));
  const [startLat, startLon, endLat, endLon] = values;
  if (["start_lat", "start_lon", "end_lat", "end_lon"].some((key) => params.get(key) === null)
    || values.some((value) => !Number.isFinite(value))
    || Math.abs(startLat) > 90 || Math.abs(endLat) > 90 || Math.abs(startLon) > 180 || Math.abs(endLon) > 180) {
    return NextResponse.json({ detail: "Valid start and destination coordinates are required." }, { status: 422 });
  }
  const hazards = params.getAll("hazard").slice(0, 30).flatMap((value) => {
    const [lat, lon] = value.split(",").map(Number);
    return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? [{ lat, lon }] : [];
  });

  try {
    const url = new URL(`https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${endLon},${endLat}`);
    url.searchParams.set("overview", "full");
    url.searchParams.set("geometries", "geojson");
    url.searchParams.set("steps", "true");
    url.searchParams.set("alternatives", "3");
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error("Directions service is unavailable.");
    const raw = await response.json() as OsrmResponse;
    const candidates = raw.code === "Ok" ? raw.routes || [] : [];
    const route = [...candidates].sort((first, second) => {
      const riskDifference = hazardCount(first, hazards) - hazardCount(second, hazards);
      return riskDifference || first.distance - second.distance;
    })[0] || null;
    const coordinates = route?.geometry?.coordinates;
    if (!route || !Array.isArray(coordinates) || coordinates.length < 2) {
      return NextResponse.json({ route_found: false, distance_km: null, duration_min: null, coordinates: [], steps: [], destination: { lat: endLat, lon: endLon }, routes_considered: candidates.length });
    }
    const steps = (route.legs || []).flatMap((leg) => (leg.steps || []).map((step) => {
      const maneuver = step.maneuver || {};
      const name = step.name || "the road";
      const action = String(maneuver.type || "continue").replaceAll("_", " ");
      const instruction = maneuver.modifier
        ? `${action.charAt(0).toUpperCase()}${action.slice(1)} ${maneuver.modifier} onto ${name}`
        : `${action.charAt(0).toUpperCase()}${action.slice(1)} on ${name}`;
      return { instruction, distance_km: Math.round(Number(step.distance || 0) / 10) / 100, location: maneuver.location };
    }));
    return NextResponse.json({
      route_found: true,
      distance_km: Math.round(Number(route.distance) / 10) / 100,
      duration_min: Math.round(Number(route.duration) / 6) / 10,
      coordinates,
      steps,
      destination: { lat: endLat, lon: endLon },
      routes_considered: candidates.length,
    });
  } catch {
    return NextResponse.json({ detail: "Could not load directions. Please try again." }, { status: 502 });
  }
}
