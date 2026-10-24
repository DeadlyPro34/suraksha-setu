import { DrivingDirections } from "./types";

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(lat2 - lat1); const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function nextRouteInstruction(directions: DrivingDirections, position: { lat: number; lon: number } | null) {
  if (!position) return directions.steps[0] || null;
  const closestCoordinateIndex = (lat: number, lon: number) => directions.coordinates.reduce((best, [routeLon, routeLat], index, coordinates) =>
    distanceKm(lat, lon, routeLat, routeLon) < distanceKm(lat, lon, coordinates[best][1], coordinates[best][0]) ? index : best, 0);
  const currentIndex = closestCoordinateIndex(position.lat, position.lon);
  return directions.steps.find((step) => step.location && closestCoordinateIndex(step.location[1], step.location[0]) > currentIndex + 2)
    || directions.steps[directions.steps.length - 1]
    || null;
}
