"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getDrivingDirections } from "@/lib/api";
import { Alert, DrivingDirections } from "@/lib/types";

export interface NavigationPosition {
  lat: number;
  lon: number;
  accuracy: number;
}

const OFF_ROUTE_METERS = 150;
const MAX_REROUTES_PER_TRIP = 3;
const REROUTE_COOLDOWN_MS = 30_000;

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distanceFromRoute(position: NavigationPosition, coordinates: [number, number][]) {
  let nearest = Number.POSITIVE_INFINITY;
  for (const [lon, lat] of coordinates) {
    nearest = Math.min(nearest, distanceMeters(position.lat, position.lon, lat, lon));
  }
  return nearest;
}

export function useNavigation(directions: DrivingDirections | null, alerts: Alert[] = []) {
  const [active, setActive] = useState(false);
  const [position, setPosition] = useState<NavigationPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rerouting, setRerouting] = useState(false);
  const [reroutedRoute, setReroutedRoute] = useState<DrivingDirections | null>(null);
  const [rerouteNotice, setRerouteNotice] = useState<string | null>(null);
  const routeRef = useRef<DrivingDirections | null>(directions);
  const hazardsRef = useRef<Array<{ lat: number; lon: number }>>([]);
  const deviationReadingsRef = useRef(0);
  const rerouteCountRef = useRef(0);
  const lastRerouteAtRef = useRef(0);
  const reroutingRef = useRef(false);
  const sessionRef = useRef(0);
  const route = reroutedRoute ?? directions;

  useEffect(() => {
    routeRef.current = route;
  }, [route]);

  useEffect(() => {
    hazardsRef.current = alerts
      .filter((alert) => (alert.type === "evacuation" || alert.type === "warning") && alert.lat != null && alert.lon != null)
      .slice(0, 30)
      .map((alert) => ({ lat: alert.lat!, lon: alert.lon! }));
  }, [alerts]);

  useEffect(() => {
    setReroutedRoute(null);
    setRerouteNotice(null);
    routeRef.current = directions;
    deviationReadingsRef.current = 0;
    rerouteCountRef.current = 0;
    lastRerouteAtRef.current = 0;
  }, [directions]);

  const start = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Live location is unavailable in this browser.");
      return;
    }
    setError(null);
    setRerouteNotice(null);
    navigator.geolocation.getCurrentPosition(
      (result) => {
        setPosition({ lat: result.coords.latitude, lon: result.coords.longitude, accuracy: result.coords.accuracy });
        sessionRef.current += 1;
        setActive(true);
      },
      (reason) => {
        setError(reason.code === reason.PERMISSION_DENIED
          ? "Location permission was denied. Allow location access in your browser to start navigation."
          : "Could not get your current location. Check your connection and try again.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 },
    );
  }, []);

  const stop = useCallback(() => {
    sessionRef.current += 1;
    setActive(false);
    setRerouting(false);
    reroutingRef.current = false;
    setError(null);
  }, []);

  useEffect(() => {
    if (!active || !navigator.geolocation) return;
    const sessionId = sessionRef.current;
    const watchId = navigator.geolocation.watchPosition(
      (result) => {
        const currentPosition = { lat: result.coords.latitude, lon: result.coords.longitude, accuracy: result.coords.accuracy };
        setPosition(currentPosition);
        setError((current) => current?.startsWith("Live location was interrupted") ? null : current);

        const currentRoute = routeRef.current;
        if (!currentRoute || currentRoute.coordinates.length < 2 || !currentRoute.destination || currentPosition.accuracy > 100) return;
        const offRoute = distanceFromRoute(currentPosition, currentRoute.coordinates) > OFF_ROUTE_METERS;
        deviationReadingsRef.current = offRoute ? deviationReadingsRef.current + 1 : 0;
        if (!offRoute || deviationReadingsRef.current < 2 || reroutingRef.current) return;

        const now = Date.now();
        if (now - lastRerouteAtRef.current < REROUTE_COOLDOWN_MS) return;
        if (rerouteCountRef.current >= MAX_REROUTES_PER_TRIP) {
          setError("Automatic rerouting paused after several route changes. Check current conditions and choose a route again.");
          return;
        }

        reroutingRef.current = true;
        setRerouting(true);
        setRerouteNotice(null);
        deviationReadingsRef.current = 0;
        lastRerouteAtRef.current = now;
        void getDrivingDirections(currentPosition, currentRoute.destination, hazardsRef.current)
          .then((updatedRoute) => {
            if (sessionRef.current !== sessionId) return;
            if (!updatedRoute.route_found) throw new Error("A new route could not be found.");
            rerouteCountRef.current += 1;
            routeRef.current = updatedRoute;
            setReroutedRoute(updatedRoute);
            setError(null);
            setRerouteNotice("Route updated from your current location. Review the new directions before continuing.");
          })
          .catch(() => {
            if (sessionRef.current === sessionId) setError("Could not recalculate the route. Stop and check current road conditions before continuing.");
          })
          .finally(() => {
            if (sessionRef.current === sessionId) {
              reroutingRef.current = false;
              setRerouting(false);
            }
          });
      },
      () => setError("Live location was interrupted. Check that location access is still enabled."),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [active]);

  return { active, position, error, rerouting, rerouteNotice, route, start, stop };
}
