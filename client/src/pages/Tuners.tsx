import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ListingWithDetails } from "@shared/schema";
import { Layout, Section, Eyebrow } from "@/components/Layout";
import { TunerCard } from "@/components/TunerCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PLATFORMS, CATEGORY_LABELS, parseMakes, money } from "@/lib/format";
import { SlidersHorizontal, SearchX } from "lucide-react";

function useQueryParams() {
  const [params, setParams] = useState(() => new URLSearchParams(window.location.hash.split("?")[1] || ""));
  useEffect(() => {
    const handler = () => setParams(new URLSearchParams(window.location.hash.split("?")[1] || ""));
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  return params;
}

export default function Tuners() {
  const params = useQueryParams();
  const { data: listings, isLoading } = useQuery<ListingWithDetails[]>({ queryKey: ["/api/listings"] });

  const [make, setMake] = useState(params.get("make") || "all");
  const [service, setService] = useState(params.get("service") || "all");
  const [mode, setMode] = useState(params.get("mode") || "all");
  const [location, setLocation] = useState("");
  const [maxPrice, setMaxPrice] = useState(1500);

  useEffect(() => {
    if (params.get("make")) setMake(params.get("make")!);
    if (params.get("service")) setService(params.get("service")!);
    if (params.get("mode")) setMode(params.get("mode")!);
  }, [params]);

  const filtered = useMemo(() => {
    let list = listings ?? [];
    if (make !== "all") list = list.filter((l) => parseMakes(l.supportedMakes).includes(make));
    if (service !== "all") list = list.filter((l) => l.services.some((s) => s.category === service));
    if (mode === "remote") list = list.filter((l) => l.remoteAvailable);
    if (mode === "dyno") list = list.filter((l) => l.dynoAvailable);
    if (location.trim()) list = list.filter((l) => l.location.toLowerCase().includes(location.trim().toLowerCase()));
    list = list.filter((l) => l.startingPrice <= maxPrice);
    return list;
  }, [listings, make, service, mode, location, maxPrice]);

  function reset() {
    setMake("all"); setService("all"); setMode("all"); setLocation(""); setMaxPrice(1500);
  }

  return (
    <Layout>
      <Section className="pb-8 pt-12">
        <Eyebrow>Find a Tuner</Eyebrow>
        <h1 className="mt-4 font-display text-4xl font-bold md:text-5xl">Browse verified tuners.</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Filter by platform, service type, availability, location, and budget. Only tuners with an active
          subscription appear here.
        </p>
      </Section>

      <Section className="pt-0">
        <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
          {/* Filters */}
          <Card className="h-fit p-5 lg:sticky lg:top-24">
            <div className="flex items-center gap-2 font-semibold">
              <SlidersHorizontal className="h-4 w-4" /> Filters
            </div>
            <div className="mt-5 space-y-5">
              <div>
                <Label className="text-xs text-muted-foreground">Make / platform</Label>
                <Select value={make} onValueChange={setMake}>
                  <SelectTrigger className="mt-1.5" data-testid="select-filter-make"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All platforms</SelectItem>
                    {PLATFORMS.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Service type</Label>
                <Select value={service} onValueChange={setService}>
                  <SelectTrigger className="mt-1.5" data-testid="select-filter-service"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All services</SelectItem>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Availability</Label>
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger className="mt-1.5" data-testid="select-filter-mode"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any</SelectItem>
                    <SelectItem value="remote">Remote available</SelectItem>
                    <SelectItem value="dyno">In-person / dyno</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground" htmlFor="filter-location">Location</Label>
                <Input id="filter-location" className="mt-1.5" placeholder="City or state" value={location} onChange={(e) => setLocation(e.target.value)} data-testid="input-filter-location" />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Max starting price</Label>
                  <span className="text-sm font-medium">{money(maxPrice)}</span>
                </div>
                <Slider className="mt-3" min={100} max={1500} step={50} value={[maxPrice]} onValueChange={(v) => setMaxPrice(v[0])} data-testid="slider-filter-price" />
              </div>
              <Button variant="outline" className="w-full" onClick={reset} data-testid="button-reset-filters">Reset filters</Button>
            </div>
          </Card>

          {/* Results */}
          <div>
            <div className="mb-4 text-sm text-muted-foreground" data-testid="text-result-count">
              {isLoading ? "Loading…" : `${filtered.length} tuner${filtered.length === 1 ? "" : "s"} found`}
            </div>
            {isLoading ? (
              <div className="grid gap-5 sm:grid-cols-2">
                {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-80 rounded-xl" />)}
              </div>
            ) : filtered.length === 0 ? (
              <Card className="flex flex-col items-center justify-center gap-3 p-16 text-center">
                <SearchX className="h-10 w-10 text-muted-foreground" />
                <div className="font-display text-lg font-bold">No tuners match those filters</div>
                <p className="max-w-sm text-sm text-muted-foreground">Try widening your price range, switching platforms, or clearing the location filter.</p>
                <Button variant="outline" onClick={reset} data-testid="button-empty-reset">Clear filters</Button>
              </Card>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                {filtered.map((l) => <TunerCard key={l.id} listing={l} />)}
              </div>
            )}
          </div>
        </div>
      </Section>
    </Layout>
  );
}
