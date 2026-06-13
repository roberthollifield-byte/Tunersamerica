import { useEffect, useState } from "react";
import type { ListingWithDetails } from "@shared/schema";
import { geocode, haversineMiles, type LatLon } from "./distance";

export type ListingWithDistance = ListingWithDetails & {
  distanceMiles: number | null;
};

// Given a user-entered ZIP/location and a list of listings, resolves the
// origin point and each listing's location to lat/lon and computes distance
// in miles. Listings whose location can't be geocoded get distanceMiles=null
// (kept in the list so they aren't silently hidden when no origin is set).
export function useListingDistances(
  listings: ListingWithDetails[] | undefined,
  originText: string,
): {
  annotated: ListingWithDistance[];
  origin: LatLon | null;
  resolving: boolean;
} {
  const [origin, setOrigin] = useState<LatLon | null>(null);
  const [listingCoords, setListingCoords] = useState<Record<number, LatLon | null>>({});
  const [resolving, setResolving] = useState(false);

  // Resolve origin whenever the entered text changes (debounced lightly).
  useEffect(() => {
    let cancelled = false;
    const trimmed = originText.trim();
    if (!trimmed) {
      setOrigin(null);
      return;
    }
    setResolving(true);
    const t = window.setTimeout(async () => {
      const r = await geocode(trimmed);
      if (!cancelled) {
        setOrigin(r);
        setResolving(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      setResolving(false);
    };
  }, [originText]);

  // Resolve listing coordinates as listings load.
  useEffect(() => {
    if (!listings || listings.length === 0) return;
    let cancelled = false;
    (async () => {
      const updates: Record<number, LatLon | null> = {};
      for (const l of listings) {
        if (l.id in listingCoords) continue;
        const c = await geocode(l.location || "");
        if (cancelled) return;
        updates[l.id] = c;
      }
      if (!cancelled && Object.keys(updates).length > 0) {
        setListingCoords((prev) => ({ ...prev, ...updates }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings]);

  const annotated: ListingWithDistance[] = (listings ?? []).map((l) => {
    const c = listingCoords[l.id];
    const distanceMiles =
      origin && c ? Math.round(haversineMiles(origin, c)) : null;
    return { ...l, distanceMiles };
  });

  return { annotated, origin, resolving };
}
