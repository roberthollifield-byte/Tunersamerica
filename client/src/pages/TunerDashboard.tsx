import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { ListingWithDetails } from "@shared/schema";
import { Layout, Section } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { money, CATEGORY_LABELS, parseMakes } from "@/lib/format";
import { PromoRedeemBox } from "@/lib/promo";
import {
  Store, Wrench, Calendar, DollarSign, CreditCard, Link2,
  Loader2, CheckCircle2, AlertTriangle, Gauge, Wifi, Save,
} from "lucide-react";

// Default name + description shown when a tuner first enables a service category.
const SERVICE_DEFAULTS: Record<string, { name: string; description: string; price: number }> = {
  remote: { name: "Remote tuning", description: "File reads, datalog review, and tune revisions delivered remotely.", price: 350 },
  dyno: { name: "Dyno tuning", description: "Full in-person dyno calibration session.", price: 800 },
  diagnostics: { name: "Diagnostics", description: "Drivability and fault diagnosis with log review.", price: 150 },
  ecu: { name: "ECU calibration", description: "Engine ECU calibration for supported platforms.", price: 500 },
  tcm: { name: "TCM calibration", description: "Transmission control module tuning.", price: 400 },
  build_support: { name: "Build support", description: "Hardware, injector, fuel-system, and boost setup guidance.", price: 250 },
  race_setup: { name: "Race setup", description: "Track and drag-strip dedicated calibrations.", price: 1200 },
};

const STATUS_COLOR: Record<string, string> = {
  requested: "bg-amber-500/15 text-amber-400",
  accepted: "bg-primary/15 text-primary",
  in_progress: "bg-blue-500/15 text-blue-400",
  completed: "bg-emerald-500/15 text-emerald-400",
  cancelled: "bg-destructive/15 text-destructive",
};
const NEXT_STATUS: Record<string, string> = { requested: "accepted", accepted: "in_progress", in_progress: "completed" };

function DemoBadge() {
  return <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-400"><AlertTriangle className="h-3 w-3" /> Demo mode</Badge>;
}

export default function TunerDashboard() {
  const { user, token } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: listing, isLoading } = useQuery<ListingWithDetails | null>({
    queryKey: ["/api/me/listing", token],
    queryFn: async () => (await apiRequest("GET", `/api/me/listing?token=${token}`)).json(),
    enabled: !!token,
  });
  const { data: bookings } = useQuery<any[]>({
    queryKey: ["/api/bookings", "tuner", user?.id],
    queryFn: async () => (await apiRequest("GET", `/api/bookings?tunerId=${user!.id}`)).json(),
    enabled: !!user,
  });

  const subscribe = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/stripe/subscribe", { token })).json(),
    onSuccess: (data: any) => {
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      queryClient.invalidateQueries();
      toast({ title: "Subscription active", description: "Your listing is now visible to drivers." });
    },
  });
  const connect = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/stripe/connect/onboard", { token })).json(),
    onSuccess: () => { queryClient.invalidateQueries(); toast({ title: "Stripe Connect linked (demo)" }); },
  });
  const advance = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => (await apiRequest("PATCH", `/api/bookings/${id}`, { status })).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/bookings", "tuner", user?.id] }),
  });

  if (!user) {
    return <Layout><Section><Card className="p-8 text-center"><p className="text-muted-foreground">Please sign in.</p><Button className="mt-4" onClick={() => navigate("/signin?role=tuner")}>Sign in</Button></Card></Section></Layout>;
  }

  const active = user.hostSubscriptionStatus === "active";
  const earnings = (bookings ?? []).filter((b) => b.paid).reduce((sum, b) => sum + (b.subtotal ?? 0), 0);
  const pending = (bookings ?? []).filter((b) => b.status === "requested").length;

  return (
    <Layout>
      <Section className="py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-3xl font-bold">Tuner dashboard</h1>
              <DemoBadge />
            </div>
            <p className="mt-1 text-muted-foreground">{listing?.shopName ?? user.name}</p>
          </div>
          <Badge className={active ? "bg-emerald-500/15 text-emerald-400" : "bg-destructive/15 text-destructive"} data-testid="badge-subscription-status">
            {active ? "Subscription active" : "Subscription inactive"}
          </Badge>
        </div>

        {!active && (
          <Alert className="mt-6 border-amber-500/40">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Your listing is hidden</AlertTitle>
            <AlertDescription>Subscribe for $99/year to make your listing visible to drivers in the marketplace.</AlertDescription>
          </Alert>
        )}

        {/* KPI row */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            { label: "Paid earnings", value: money(earnings), icon: DollarSign },
            { label: "Pending requests", value: String(pending), icon: Calendar },
            { label: "Listing status", value: active ? "Live" : "Hidden", icon: Store },
          ].map((k) => (
            <Card key={k.label} className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{k.label}</span>
                <k.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-2 font-display text-2xl font-bold" data-testid={`kpi-${k.label.toLowerCase().replace(/\s+/g, "-")}`}>{k.value}</div>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="listing" className="mt-8">
          <TabsList className="flex-wrap">
            <TabsTrigger value="listing" data-testid="tab-listing"><Store className="mr-2 h-4 w-4" />Listing</TabsTrigger>
            <TabsTrigger value="services" data-testid="tab-services"><Wrench className="mr-2 h-4 w-4" />Services & Pricing</TabsTrigger>
            <TabsTrigger value="bookings" data-testid="tab-tuner-bookings"><Calendar className="mr-2 h-4 w-4" />Bookings</TabsTrigger>
            <TabsTrigger value="earnings" data-testid="tab-earnings"><DollarSign className="mr-2 h-4 w-4" />Earnings</TabsTrigger>
            <TabsTrigger value="subscription" data-testid="tab-subscription"><CreditCard className="mr-2 h-4 w-4" />Subscription</TabsTrigger>
            <TabsTrigger value="stripe" data-testid="tab-stripe"><Link2 className="mr-2 h-4 w-4" />Stripe Connect</TabsTrigger>
          </TabsList>

          {/* Listing */}
          <TabsContent value="listing" className="mt-6">
            {isLoading ? <Skeleton className="h-48 w-full" /> : listing ? (
              <Card className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-xl font-bold">{listing.shopName}</h2>
                    <p className="text-sm text-muted-foreground">{listing.location}</p>
                  </div>
                  <div className="flex gap-2">
                    {listing.dynoAvailable && <Badge className="gap-1"><Gauge className="h-3 w-3" />Dyno</Badge>}
                    {listing.remoteAvailable && <Badge className="gap-1"><Wifi className="h-3 w-3" />Remote</Badge>}
                  </div>
                </div>
                <p className="mt-4 text-muted-foreground">{listing.bio}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {parseMakes(listing.supportedMakes).map((m) => <Badge key={m} variant="secondary">{m}</Badge>)}
                </div>
                <div className="mt-5 flex gap-2">
                  <Button variant="outline" onClick={() => navigate(`/tuners/${listing.id}`)} data-testid="button-view-public">View public profile</Button>
                </div>
              </Card>
            ) : <Card className="p-12 text-center text-muted-foreground">No listing found for this account.</Card>}
          </TabsContent>

          {/* Services */}
          <TabsContent value="services" className="mt-6">
            {listing ? (
              <ServicesEditor listing={listing} token={token!} />
            ) : <Card className="p-12 text-center text-muted-foreground">No listing yet — create your shop profile first.</Card>}
          </TabsContent>

          {/* Bookings */}
          <TabsContent value="bookings" className="mt-6">
            {(bookings?.length ?? 0) === 0 ? (
              <Card className="p-12 text-center text-muted-foreground">No bookings yet.</Card>
            ) : (
              <div className="space-y-3">
                {bookings!.map((b) => (
                  <Card key={b.id} className="flex flex-wrap items-center justify-between gap-4 p-5" data-testid={`card-tuner-booking-${b.id}`}>
                    <div>
                      <div className="font-semibold">{b.serviceName ?? "Service"} · {b.customerName}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{b.vehicleLabel} · subtotal {money(b.subtotal)} · earns {money(b.subtotal)}</div>
                      {b.notes && <div className="mt-1 text-xs text-muted-foreground">"{b.notes}"</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={STATUS_COLOR[b.status]}>{b.status.replace("_", " ")}</Badge>
                      {NEXT_STATUS[b.status] && (
                        <Button size="sm" variant="outline" onClick={() => advance.mutate({ id: b.id, status: NEXT_STATUS[b.status] })} data-testid={`button-advance-${b.id}`}>
                          Mark {NEXT_STATUS[b.status].replace("_", " ")}
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Earnings */}
          <TabsContent value="earnings" className="mt-6">
            <Card className="p-6">
              <h2 className="font-display text-lg font-bold">Earnings overview</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border p-4">
                  <div className="text-sm text-muted-foreground">Paid out (demo)</div>
                  <div className="mt-1 font-display text-2xl font-bold" data-testid="text-earnings-paid">{money(earnings)}</div>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <div className="text-sm text-muted-foreground">Note</div>
                  <p className="mt-1 text-sm text-muted-foreground">Tuners receive 100% of the service price. Buyers pay TunersAmerica a separate $10 / 30-day access pass to reach the directory.</p>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Subscription */}
          <TabsContent value="subscription" className="mt-6">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold">Host subscription</h2>
                <DemoBadge />
              </div>
              <div className="mt-3 flex items-end gap-1">
                <span className="font-display text-3xl font-bold">$99</span><span className="pb-1 text-muted-foreground">/ year</span>
              </div>
              {active ? (
                <Alert className="mt-4 border-emerald-500/40">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Subscription active</AlertTitle>
                  <AlertDescription>Your listing is live in the marketplace.</AlertDescription>
                </Alert>
              ) : (
                <>
                  <Button className="mt-4" size="lg" onClick={() => subscribe.mutate()} disabled={subscribe.isPending} data-testid="button-subscribe">
                    {subscribe.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                    Subscribe — $99/year
                  </Button>
                  <div className="mt-6 border-t pt-6">
                    <p className="mb-2 text-sm font-medium">Have a promo code?</p>
                    <PromoRedeemBox audience="tuner" />
                  </div>
                </>
              )}
            </Card>
          </TabsContent>

          {/* Stripe Connect */}
          <TabsContent value="stripe" className="mt-6">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold">Stripe Connect</h2>
                <DemoBadge />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Connect a Stripe account to receive payouts for completed bookings.</p>
              {user.stripeAccountId ? (
                <Alert className="mt-4 border-emerald-500/40">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Connected</AlertTitle>
                  <AlertDescription className="font-mono text-xs">{user.stripeAccountId}</AlertDescription>
                </Alert>
              ) : (
                <Button className="mt-4" onClick={() => connect.mutate()} disabled={connect.isPending} data-testid="button-connect-stripe">
                  {connect.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                  Connect Stripe account
                </Button>
              )}
              <p className="mt-3 text-xs text-muted-foreground">Production uses Stripe Connect Express onboarding.</p>
            </Card>
          </TabsContent>
        </Tabs>
      </Section>
    </Layout>
  );
}

/* ------------- Services editor ------------- */

type EditableService = {
  category: string;
  enabled: boolean;
  name: string;
  description: string;
  price: number;
};

function buildInitialRows(listing: ListingWithDetails): EditableService[] {
  const byCategory = new Map<string, ListingWithDetails["services"][number]>();
  for (const s of listing.services) byCategory.set(s.category, s);
  return Object.keys(CATEGORY_LABELS).map((cat) => {
    const existing = byCategory.get(cat);
    const def = SERVICE_DEFAULTS[cat] || { name: CATEGORY_LABELS[cat], description: "", price: 0 };
    if (existing) {
      return {
        category: cat,
        enabled: true,
        name: existing.name,
        description: existing.description,
        price: existing.price,
      };
    }
    return {
      category: cat,
      enabled: false,
      name: def.name,
      description: def.description,
      price: def.price,
    };
  });
}

function ServicesEditor({ listing, token }: { listing: ListingWithDetails; token: string }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<EditableService[]>(() => buildInitialRows(listing));

  // Re-seed when the underlying listing changes (e.g. after save / refetch).
  useEffect(() => {
    setRows(buildInitialRows(listing));
  }, [listing]);

  const save = useMutation({
    mutationFn: async () => {
      const services = rows
        .filter((r) => r.enabled)
        .map((r) => ({
          category: r.category,
          name: r.name.trim() || CATEGORY_LABELS[r.category],
          description: r.description.trim(),
          price: Math.max(0, Math.round(Number(r.price) || 0)),
        }));
      const res = await apiRequest("PUT", "/api/me/services", { token, services });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Services saved", description: "Your service menu is updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/me/listing", token] });
      queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't save services",
        description: err?.message || "Try again.",
        variant: "destructive",
      });
    },
  });

  function update(category: string, patch: Partial<EditableService>) {
    setRows((prev) => prev.map((r) => (r.category === category ? { ...r, ...patch } : r)));
  }

  const enabledCount = rows.filter((r) => r.enabled).length;

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">Services you offer</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Toggle the services you provide and set a starting price for each. Drivers see only the
            services you've enabled.
          </p>
        </div>
        <Badge variant="outline" className="text-xs" data-testid="badge-services-count">
          {enabledCount} {enabledCount === 1 ? "service" : "services"} enabled
        </Badge>
      </div>

      <div className="mt-5 space-y-3">
        {rows.map((r) => (
          <div
            key={r.category}
            className={`rounded-lg border p-4 transition-colors ${
              r.enabled ? "border-primary/40 bg-primary/5" : "border-border bg-card/40"
            }`}
            data-testid={`row-service-${r.category}`}
          >
            <div className="flex flex-wrap items-center gap-3">
              <Checkbox
                id={`enable-${r.category}`}
                checked={r.enabled}
                onCheckedChange={(v) => update(r.category, { enabled: !!v })}
                data-testid={`checkbox-service-${r.category}`}
              />
              <Label htmlFor={`enable-${r.category}`} className="cursor-pointer font-semibold">
                {CATEGORY_LABELS[r.category]}
              </Label>
              <div className="ml-auto flex items-center gap-2">
                <Label htmlFor={`price-${r.category}`} className="text-xs text-muted-foreground">
                  Starting at
                </Label>
                <div className="flex items-center">
                  <span className="text-muted-foreground">$</span>
                  <Input
                    id={`price-${r.category}`}
                    type="number"
                    min={0}
                    step={25}
                    disabled={!r.enabled}
                    value={r.price}
                    onChange={(e) => update(r.category, { price: Number(e.target.value) })}
                    className="ml-1 w-28"
                    data-testid={`input-price-${r.category}`}
                  />
                </div>
              </div>
            </div>
            {r.enabled && (
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_2fr]">
                <div className="space-y-1.5">
                  <Label htmlFor={`name-${r.category}`} className="text-xs text-muted-foreground">
                    Display name
                  </Label>
                  <Input
                    id={`name-${r.category}`}
                    value={r.name}
                    onChange={(e) => update(r.category, { name: e.target.value })}
                    data-testid={`input-name-${r.category}`}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor={`description-${r.category}`}
                    className="text-xs text-muted-foreground"
                  >
                    Short description
                  </Label>
                  <Input
                    id={`description-${r.category}`}
                    value={r.description}
                    onChange={(e) => update(r.category, { description: e.target.value })}
                    data-testid={`input-description-${r.category}`}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <Button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          data-testid="button-save-services"
        >
          {save.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save services
        </Button>
      </div>
    </Card>
  );
}
