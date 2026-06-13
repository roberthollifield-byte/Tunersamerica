// Lightweight client-side ZIP / city geocoding + haversine distance.
// Uses zippopotam.us (free, no key) and caches results in localStorage so
// repeat lookups are instant and offline-tolerant after the first hit.

export type LatLon = { lat: number; lon: number };

const CACHE_KEY = "tunersamerica.geocache.v1";

function loadCache(): Record<string, LatLon | null> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveCache(c: Record<string, LatLon | null>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    // ignore quota / sandbox errors
  }
}

const memCache = loadCache();
const inflight = new Map<string, Promise<LatLon | null>>();

async function fetchZip(zip: string): Promise<LatLon | null> {
  try {
    const r = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!r.ok) return null;
    const j = await r.json();
    const place = j?.places?.[0];
    if (!place) return null;
    const lat = parseFloat(place.latitude);
    const lon = parseFloat(place.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  } catch {
    return null;
  }
}

async function fetchCityState(
  city: string,
  state: string,
): Promise<LatLon | null> {
  try {
    const r = await fetch(
      `https://api.zippopotam.us/us/${state.toLowerCase()}/${encodeURIComponent(
        city.toLowerCase(),
      )}`,
    );
    if (!r.ok) return null;
    const j = await r.json();
    const places = Array.isArray(j?.places) ? j.places : [];
    if (places.length === 0) return null;
    // Average all returned ZIPs in that city for a stable centroid.
    let lat = 0;
    let lon = 0;
    let n = 0;
    for (const p of places) {
      const la = parseFloat(p.latitude);
      const lo = parseFloat(p.longitude);
      if (Number.isFinite(la) && Number.isFinite(lo)) {
        lat += la;
        lon += lo;
        n += 1;
      }
    }
    if (n === 0) return null;
    return { lat: lat / n, lon: lon / n };
  } catch {
    return null;
  }
}

// Extract the most useful geocodable signal from a free-form location string.
// Priority: 5-digit ZIP > "City, ST" > "City ST" (state at end).
function parseLocation(loc: string): { kind: "zip" | "city"; key: string } | null {
  if (!loc) return null;
  const zipMatch = loc.match(/\b\d{5}\b/);
  if (zipMatch) return { kind: "zip", key: zipMatch[0] };

  const commaMatch = loc.match(/([A-Za-z][A-Za-z .'\-]+),\s*([A-Za-z]{2})\b/);
  if (commaMatch) {
    const city = commaMatch[1].trim();
    const state = commaMatch[2].trim().toUpperCase();
    return { kind: "city", key: `${state}|${city}` };
  }

  // "PIEDMONT SC" style (state code at end).
  const spaceMatch = loc.match(/^(.*?)[\s,]+([A-Za-z]{2})\s*$/);
  if (spaceMatch) {
    const city = spaceMatch[1].trim();
    const state = spaceMatch[2].trim().toUpperCase();
    if (city) return { kind: "city", key: `${state}|${city}` };
  }

  return null;
}

export async function geocode(loc: string): Promise<LatLon | null> {
  const parsed = parseLocation(loc);
  if (!parsed) return null;
  const cacheKey = `${parsed.kind}:${parsed.key}`;
  if (cacheKey in memCache) return memCache[cacheKey];

  if (inflight.has(cacheKey)) return inflight.get(cacheKey)!;

  const promise = (async () => {
    let result: LatLon | null = null;
    if (parsed.kind === "zip") {
      result = await fetchZip(parsed.key);
    } else {
      const [state, city] = parsed.key.split("|");
      result = await fetchCityState(city, state);
    }
    memCache[cacheKey] = result;
    saveCache(memCache);
    inflight.delete(cacheKey);
    return result;
  })();

  inflight.set(cacheKey, promise);
  return promise;
}

export function haversineMiles(a: LatLon, b: LatLon): number {
  const R = 3958.8; // earth radius in miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const DISTANCE_OPTIONS: { value: string; label: string; miles: number | null }[] = [
  { value: "25", label: "25 mi", miles: 25 },
  { value: "50", label: "50 mi", miles: 50 },
  { value: "100", label: "100 mi", miles: 100 },
  { value: "250", label: "250 mi", miles: 250 },
  { value: "500", label: "500 mi", miles: 500 },
  { value: "any", label: "Any distance", miles: null },
];
