import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ListingWithDetails } from "@shared/schema";
import { Layout, Section, Eyebrow } from "@/components/Layout";
import { TunerCard } from "@/components/TunerCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CAPABILITY_GROUPS, capabilityLabel } from "@/lib/format";
import { SlidersHorizontal, SearchX } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { usePassGate, PassPaywall } from "@/lib/pass";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useListingDistances } from "@/lib/useDistance";
import { DISTANCE_OPTIONS } from "@/lib/distance";

function useQueryParams() {
  const [params, setParams] = useState(
    () => new URLSearchParams(window.location.hash.split("?")[1] || ""),
  );
  useEffect(() => {
    const handler = () =>
      setParams(new URLSearchParams(window.location.hash.split("?")[1] || ""));
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  return params;
}

// Selected values per capability group: { [groupKey]: Set<value> }
type SelectedState = Record<string, Set<string>>;

function emptySelection(): SelectedState {
  const obj: SelectedState = {};
  for (const g of CAPABILITY_GROUPS) obj[g.key] = new Set<string>();
  return obj;
}

export default function Tuners() {
  const params = useQueryParams();
  const { token } = useAuth();
  const { hasAccess, isLoading: gateLoading } = usePassGate();
  const { data: listings, isLoading } = useQuery<ListingWithDetails[]>({
    queryKey: ["/api/listings", token],
    enabled: hasAccess && !!token,
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/listings?token=${encodeURIComponent(token!)}`,
      );
      return res.json();
    },
  });

  const [selected, setSelected] = useState<SelectedState>(() => emptySelection());
  const [originZip, setOriginZip] = useState("");
  const [radius, setRadius] = useState<string>("100");

  // Preselect from URL query params (e.g. ?tuning_type=remote, ?zip=28043, ?radius=100)
  useEffect(() => {
    const next = emptySelection();
    for (const g of CAPABILITY_GROUPS) {
      const v = params.get(g.key);
      if (v) next[g.key].add(v);
    }
    setSelected(next);
    const z = params.get("zip");
    if (z) setOriginZip(z);
    const r = params.get("radius");
    if (r) setRadius(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  function toggle(group: string, value: string) {
    setSelected((s) => {
      const next: SelectedState = { ...s, [group]: new Set(s[group]) };
      if (next[group].has(value)) next[group].delete(value);
      else next[group].add(value);
      return next;
    });
  }

  const { annotated, origin, resolving } = useListingDistances(
    listings,
    originZip,
  );

  const radiusMiles =
    DISTANCE_OPTIONS.find((d) => d.value === radius)?.miles ?? null;

  const filtered = useMemo(() => {
    let list = annotated;
    for (const g of CAPABILITY_GROUPS) {
      const sel = selected[g.key];
      if (sel.size === 0) continue;
      list = list.filter((l) =>
        (l.capabilities ?? []).some(
          (c) => c.groupName === g.key && sel.has(c.value),
        ),
      );
    }
    if (origin && radiusMiles != null) {
      list = list.filter(
        (l) => l.distanceMiles != null && l.distanceMiles <= radiusMiles,
      );
    }
    // Sort by distance when we have an origin
    if (origin) {
      list = [...list].sort((a, b) => {
        const ad = a.distanceMiles ?? Number.POSITIVE_INFINITY;
        const bd = b.distanceMiles ?? Number.POSITIVE_INFINITY;
        return ad - bd;
      });
    }
    return list;
  }, [annotated, selected, origin, radiusMiles]);

  function reset() {
    setSelected(emptySelection());
    setOriginZip("");
    setRadius("100");
  }

  const activeFilterCount =
    CAPABILITY_GROUPS.reduce((n, g) => n + selected[g.key].size, 0) +
    (originZip.trim() ? 1 : 0);

  return (
    <Layout>
      <Section className="pb-8 pt-12">
        <Eyebrow>Find a Tuner</Eyebrow>
        <h1 className="mt-4 font-display text-4xl font-bold md:text-5xl">
          Browse verified tuners.
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Filter by tuning type, engine platform, ECU, fuel, and induction.
          Only tuners with an active subscription appear here. Access requires
          a $10 / 30-day buyer pass.
        </p>
      </Section>

      {!hasAccess && !gateLoading && (
        <Section className="pt-0">
          <PassPaywall />
        </Section>
      )}

      {hasAccess && (
        <Section className="pt-0">
          <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
            {/* Filters */}
            <Card className="h-fit p-5 lg:sticky lg:top-24">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold">
                  <SlidersHorizontal className="h-4 w-4" /> Filters
                </div>
                {activeFilterCount > 0 && (
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={reset}
                    data-testid="button-reset-filters"
                  >
                    Clear all
                  </button>
                )}
              </div>

              <div className="mt-5 space-y-5">
                <div>
                  <Label
                    className="text-xs text-muted-foreground"
                    htmlFor="filter-zip"
                  >
                    Your ZIP code
                  </Label>
                  <Input
                    id="filter-zip"
                    className="mt-1.5"
                    placeholder="e.g. 28043"
                    inputMode="numeric"
                    maxLength={5}
                    value={originZip}
                    onChange={(e) =>
                      setOriginZip(e.target.value.replace(/[^0-9]/g, ""))
                    }
                    data-testid="input-filter-zip"
                  />
                  <div className="mt-3">
                    <Label className="text-xs text-muted-foreground">
                      Distance
                    </Label>
                    <Select value={radius} onValueChange={setRadius}>
                      <SelectTrigger
                        className="mt-1.5"
                        data-testid="select-filter-radius"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DISTANCE_OPTIONS.map((d) => (
                          <SelectItem key={d.value} value={d.value}>
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {originZip.trim() && !origin && !resolving && (
                    <p className="mt-2 text-xs text-amber-500">
                      Couldn't locate that ZIP. Check it and try again.
                    </p>
                  )}
                  {resolving && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Locating…
                    </p>
                  )}
                </div>

                {CAPABILITY_GROUPS.map((g) => (
                  <div key={g.key} data-testid={`filter-group-${g.key}`}>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                      {g.label}
                    </Label>
                    <div className="mt-2 space-y-2">
                      {g.values.map((v) => {
                        const id = `flt-${g.key}-${v}`;
                        const checked = selected[g.key].has(v);
                        return (
                          <label
                            key={v}
                            htmlFor={id}
                            className="flex cursor-pointer items-center gap-2 text-sm"
                          >
                            <Checkbox
                              id={id}
                              checked={checked}
                              onCheckedChange={() => toggle(g.key, v)}
                              data-testid={`checkbox-filter-${g.key}-${v}`}
                            />
                            <span>{capabilityLabel(g.key, v)}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={reset}
                  data-testid="button-reset-filters-bottom"
                >
                  Reset filters
                </Button>
              </div>
            </Card>

            {/* Results */}
            <div>
              <div
                className="mb-4 text-sm text-muted-foreground"
                data-testid="text-result-count"
              >
                {isLoading
                  ? "Loading…"
                  : `${filtered.length} tuner${filtered.length === 1 ? "" : "s"} found`}
              </div>
              {isLoading ? (
                <div className="grid gap-5 sm:grid-cols-2">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-80 rounded-xl" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <Card className="flex flex-col items-center justify-center gap-3 p-16 text-center">
                  <SearchX className="h-10 w-10 text-muted-foreground" />
                  <div className="font-display text-lg font-bold">
                    No tuners match those filters
                  </div>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Try expanding your distance or removing a filter.
                  </p>
                  <Button
                    variant="outline"
                    onClick={reset}
                    data-testid="button-empty-reset"
                  >
                    Clear filters
                  </Button>
                </Card>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2">
                  {filtered.map((l) => (
                    <TunerCard key={l.id} listing={l} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </Section>
      )}
    </Layout>
  );
}
