import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { ListingWithDetails, TunerCapability } from "@shared/schema";
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
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { money, parseMakes, CAPABILITY_GROUPS, capabilityLabel } from "@/lib/format";
import { LeaveReviewDialog } from "@/components/LeaveReviewDialog";
import { ImageUpload } from "@/components/ImageUpload";
import { PromoRedeemBox } from "@/lib/promo";
import {
  Store, Wrench, Calendar, DollarSign, CreditCard, Link2,
  Loader2, CheckCircle2, AlertTriangle, Gauge, Wifi, Save, Phone, X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Default starting prices for tuning-type rows.
const TUNING_TYPE_PRICE_DEFAULTS: Record<string, number> = {
  dyno: 800, street: 400, track: 1200, remote: 350,
};

const STATUS_COLOR: Record<string, string> = {
  requested: "bg-amber-500/15 text-amber-400",
  accepted: "bg-primary/15 text-primary",
  in_progress: "bg-blue-500/15 text-blue-400",
  completed: "bg-emerald-500/15 text-emerald-400",
  cancelled: "bg-destructive/15 text-destructive",
};
const NEXT_STATUS: Record<string, string> = { requested: "accepted", accepted: "in_progress", in_progress: "completed" };

// Tracks which user ids have already had the auto-refresh fired this session.
// Module-level so it survives React strict-mode double effects.
const autoRefreshAttempted = new Set<number>();

function ComingSoonBadge() {
  return <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-400"><AlertTriangle className="h-3 w-3" /> Coming soon</Badge>;
}

export default function TunerDashboard() {
  const { user, token, loginWithToken } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // When Stripe redirects back with ?sub=success, refetch the user so the
  // dashboard immediately reflects host_subscription_status='active' set
  // by the webhook. Without this, the React user object is stale until sign-out.
  useEffect(() => {
    const hash = window.location.hash || "";
    const qIdx = hash.indexOf("?");
    if (qIdx === -1) return;
    const params = new URLSearchParams(hash.slice(qIdx + 1));
    if (params.get("sub") === "success" && token) {
      // Ask the server to verify against Stripe directly (safety net for any
      // webhook delivery issues), then refetch the user.
      const run = async () => {
        try {
          await apiRequest("POST", "/api/stripe/refresh-subscription", { token });
        } catch (e) {
          // Non-fatal — continue to refetch user anyway.
        }
        await loginWithToken(token);
        queryClient.invalidateQueries();
        toast({ title: "Subscription active", description: "Welcome aboard \u2014 your listing is live." });
        const base = hash.slice(0, qIdx);
        window.history.replaceState(null, "", `${window.location.pathname}${base}`);
      };
      // Small delay so any webhook racing the redirect has a head start.
      const t = setTimeout(run, 1500);
      return () => clearTimeout(t);
    }
    if (params.get("sub") === "cancelled") {
      toast({ title: "Checkout cancelled", description: "No charge was made.", variant: "destructive" });
      const base = hash.slice(0, qIdx);
      window.history.replaceState(null, "", `${window.location.pathname}${base}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Safety-net auto-refresh: if a tuner loads the dashboard and is still
  // marked inactive, ask the server to check Stripe directly. Catches users
  // who paid but never came back via the ?sub=success redirect (the webhook
  // also covers this, but webhook delivery has been flaky). Runs at most
  // once per page-load per user — bounded by a module-level Set so React
  // strict-mode double-invokes don't double-fire.
  useEffect(() => {
    if (!token || !user) return;
    if (user.role !== "tuner") return;
    if (user.hostSubscriptionStatus === "active") return;
    if (autoRefreshAttempted.has(user.id)) return;
    autoRefreshAttempted.add(user.id);
    (async () => {
      try {
        const res = await apiRequest("POST", "/api/stripe/refresh-subscription", { token });
        const data = await res.json();
        if (data?.status === "active" || data?.status === "trialing") {
          await loginWithToken(token);
          queryClient.invalidateQueries();
          toast({ title: "Subscription found", description: "Your subscription is now active." });
        }
      } catch {
        // Silent — user can still subscribe manually if needed.
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.id, user?.hostSubscriptionStatus]);

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
            <TabsTrigger value="services" data-testid="tab-services"><Wrench className="mr-2 h-4 w-4" />Capabilities</TabsTrigger>
            <TabsTrigger value="bookings" data-testid="tab-tuner-bookings"><Calendar className="mr-2 h-4 w-4" />Bookings</TabsTrigger>
            <TabsTrigger value="consults" data-testid="tab-tuner-consults"><Phone className="mr-2 h-4 w-4" />Phone Consults</TabsTrigger>
            <TabsTrigger value="earnings" data-testid="tab-earnings"><DollarSign className="mr-2 h-4 w-4" />Earnings</TabsTrigger>
            <TabsTrigger value="subscription" data-testid="tab-subscription"><CreditCard className="mr-2 h-4 w-4" />Subscription</TabsTrigger>
            <TabsTrigger value="stripe" data-testid="tab-stripe"><Link2 className="mr-2 h-4 w-4" />Stripe Connect</TabsTrigger>
          </TabsList>

          {/* Listing */}
          <TabsContent value="listing" className="mt-6">
            {isLoading ? <Skeleton className="h-48 w-full" /> : (
              <ListingEditor listing={listing ?? null} token={token!} onView={(id) => navigate(`/tuners/${id}`)} />
            )}
          </TabsContent>

          {/* Capabilities */}
          <TabsContent value="services" className="mt-6">
            {listing ? (
              <CapabilitiesEditor listing={listing} token={token!} />
            ) : <Card className="p-12 text-center text-muted-foreground">Create your shop profile on the Listing tab first.</Card>}
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
                      {b.status === "completed" && (
                        <LeaveReviewDialog
                          bookingId={b.id}
                          subject={b.customerName || "this driver"}
                          triggerLabel="Review driver"
                          invalidateKeys={[["/api/bookings", "tuner", user?.id]]}
                        />
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Phone consultations (incoming requests) */}
          <TabsContent value="consults" className="mt-6">
            <TunerConsultsPanel />
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
                <ComingSoonBadge />
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

/* ------------- Capabilities editor ------------- */

type CapState = {
  // For each group, a Set of selected values. Plus a price map for tuning_type.
  selected: Record<string, Set<string>>;
  prices: Record<string, number>; // keyed by tuning_type value, e.g. dyno -> 800
};

function buildInitialState(caps: TunerCapability[]): CapState {
  const selected: Record<string, Set<string>> = {};
  const prices: Record<string, number> = {};
  for (const g of CAPABILITY_GROUPS) selected[g.key] = new Set();
  for (const c of caps) {
    if (!selected[c.groupName]) selected[c.groupName] = new Set();
    selected[c.groupName].add(c.value);
    if (c.groupName === "tuning_type" && typeof c.price === "number") {
      prices[c.value] = c.price;
    }
  }
  return { selected, prices };
}

function CapabilitiesEditor({ listing, token }: { listing: ListingWithDetails; token: string }) {
  const { toast } = useToast();

  const { data: caps } = useQuery<TunerCapability[]>({
    queryKey: ["/api/me/capabilities", token],
    queryFn: async () => (await apiRequest("GET", `/api/me/capabilities?token=${token}`)).json(),
    enabled: !!token,
  });

  const [state, setState] = useState<CapState>(() => buildInitialState(caps ?? listing.capabilities ?? []));

  useEffect(() => {
    setState(buildInitialState(caps ?? listing.capabilities ?? []));
  }, [caps, listing]);

  function toggle(group: string, value: string) {
    setState((prev) => {
      const next: CapState = { selected: { ...prev.selected }, prices: { ...prev.prices } };
      const set = new Set(next.selected[group]);
      if (set.has(value)) {
        set.delete(value);
        if (group === "tuning_type") delete next.prices[value];
      } else {
        set.add(value);
        if (group === "tuning_type" && next.prices[value] == null) {
          next.prices[value] = TUNING_TYPE_PRICE_DEFAULTS[value] ?? 0;
        }
      }
      next.selected[group] = set;
      return next;
    });
  }

  function setPrice(value: string, price: number) {
    setState((prev) => ({ ...prev, prices: { ...prev.prices, [value]: price } }));
  }

  const save = useMutation({
    mutationFn: async () => {
      const capabilities: { groupName: string; value: string; price?: number | null }[] = [];
      for (const g of CAPABILITY_GROUPS) {
        for (const v of Array.from(state.selected[g.key] ?? [])) {
          if (g.key === "tuning_type") {
            const p = state.prices[v];
            capabilities.push({ groupName: g.key, value: v, price: typeof p === "number" ? Math.max(0, Math.round(p)) : null });
          } else {
            capabilities.push({ groupName: g.key, value: v });
          }
        }
      }
      const res = await apiRequest("PUT", "/api/me/capabilities", { token, capabilities });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Capabilities saved", description: "Drivers will see your updated capabilities." });
      queryClient.invalidateQueries({ queryKey: ["/api/me/capabilities", token] });
      queryClient.invalidateQueries({ queryKey: ["/api/me/listing", token] });
      queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
    },
    onError: (err: any) => {
      toast({ title: "Couldn't save", description: err?.message || "Try again.", variant: "destructive" });
    },
  });

  const totalSelected = Object.values(state.selected).reduce((sum, s) => sum + s.size, 0);

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">Capabilities</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Check every capability your shop offers. These power the search filters drivers use to find you.
          </p>
        </div>
        <Badge variant="outline" className="text-xs" data-testid="badge-capabilities-count">
          {totalSelected} selected
        </Badge>
      </div>

      <div className="mt-6 space-y-6">
        {CAPABILITY_GROUPS.map((g) => (
          <div key={g.key} data-testid={`group-${g.key}`}>
            <h3 className="font-semibold">{g.label}</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {g.values.map((v) => {
                const checked = state.selected[g.key]?.has(v) ?? false;
                const id = `cap-${g.key}-${v}`;
                return (
                  <div
                    key={v}
                    className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                      checked ? "border-primary/40 bg-primary/5" : "border-border bg-card/40"
                    }`}
                    data-testid={`row-cap-${g.key}-${v}`}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={id}
                        checked={checked}
                        onCheckedChange={() => toggle(g.key, v)}
                        data-testid={`checkbox-cap-${g.key}-${v}`}
                      />
                      <Label htmlFor={id} className="cursor-pointer text-sm font-medium">
                        {g.key === "tuning_type" ? capabilityLabel(g.key, v) : v}
                      </Label>
                    </div>
                    {g.key === "tuning_type" && checked && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">$</span>
                        <Input
                          type="number"
                          min={0}
                          step={25}
                          value={state.prices[v] ?? 0}
                          onChange={(e) => setPrice(v, Number(e.target.value))}
                          className="h-8 w-24"
                          data-testid={`input-price-${v}`}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="button-save-capabilities">
          {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save capabilities
        </Button>
      </div>
    </Card>
  );
}

/* ------------- Listing editor (create + edit) ------------- */

type ListingForm = {
  shopName: string;
  location: string;
  bio: string;
  dynoAvailable: boolean;
  remoteAvailable: boolean;
  startingPrice: number;
  supportedMakes: string;
  heroImage: string;
};

function formFromListing(l: ListingWithDetails | null): ListingForm {
  if (!l) {
    return {
      shopName: "", location: "", bio: "",
      dynoAvailable: false, remoteAvailable: false,
      startingPrice: 0, supportedMakes: "", heroImage: "",
    };
  }
  return {
    shopName: l.shopName ?? "",
    location: l.location ?? "",
    bio: l.bio ?? "",
    dynoAvailable: !!l.dynoAvailable,
    remoteAvailable: !!l.remoteAvailable,
    startingPrice: typeof l.startingPrice === "number" ? l.startingPrice : 0,
    supportedMakes: parseMakes(l.supportedMakes).join(", "),
    heroImage: l.heroImage ?? "",
  };
}

function ListingEditor({
  listing,
  token,
  onView,
}: {
  listing: ListingWithDetails | null;
  token: string;
  onView: (id: number) => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<ListingForm>(() => formFromListing(listing));

  useEffect(() => {
    setForm(formFromListing(listing));
  }, [listing]);

  const isCreate = !listing;

  const save = useMutation({
    mutationFn: async () => {
      const supportedMakes = form.supportedMakes
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const body = {
        token,
        shopName: form.shopName.trim(),
        location: form.location.trim(),
        bio: form.bio.trim(),
        dynoAvailable: form.dynoAvailable,
        remoteAvailable: form.remoteAvailable,
        startingPrice: Number.isFinite(form.startingPrice) ? Math.max(0, Math.round(form.startingPrice)) : 0,
        supportedMakes,
        heroImage: form.heroImage.trim() || null,
      };
      const res = await apiRequest("PUT", "/api/me/listing", body);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: isCreate ? "Shop profile created" : "Shop profile saved",
        description: isCreate
          ? "Now head to the Capabilities tab to pick what your shop offers."
          : "Drivers will see your updated profile.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/me/listing", token] });
      queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
    },
    onError: (err: any) => {
      toast({ title: "Couldn't save", description: err?.message || "Try again.", variant: "destructive" });
    },
  });

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">
            {isCreate ? "Create your shop profile" : "Edit shop profile"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isCreate
              ? "Fill these in to publish your listing in the directory."
              : "Update what drivers see when they find you."}
          </p>
        </div>
        {!isCreate && listing && (
          <Button variant="outline" onClick={() => onView(listing.id)} data-testid="button-view-public">
            View public profile
          </Button>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="li-shopName">Shop name *</Label>
          <Input
            id="li-shopName"
            value={form.shopName}
            onChange={(e) => setForm((f) => ({ ...f, shopName: e.target.value }))}
            placeholder="e.g. Hollifield Performance"
            data-testid="input-listing-shopname"
          />
        </div>
        <div>
          <Label htmlFor="li-location">Location *</Label>
          <Input
            id="li-location"
            value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            placeholder="City, State"
            data-testid="input-listing-location"
          />
        </div>
        <div>
          <Label htmlFor="li-price">Starting price ($)</Label>
          <Input
            id="li-price"
            type="number"
            min={0}
            step={25}
            value={form.startingPrice}
            onChange={(e) => setForm((f) => ({ ...f, startingPrice: Number(e.target.value) }))}
            data-testid="input-listing-price"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="li-bio">About your shop</Label>
          <Textarea
            id="li-bio"
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            rows={4}
            placeholder="What makes your shop different? Specialties, dyno specs, years in business…"
            data-testid="input-listing-bio"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="li-makes">Supported makes (comma separated)</Label>
          <Input
            id="li-makes"
            value={form.supportedMakes}
            onChange={(e) => setForm((f) => ({ ...f, supportedMakes: e.target.value }))}
            placeholder="Chevrolet, Ford, Dodge, Toyota…"
            data-testid="input-listing-makes"
          />
        </div>
        <div className="sm:col-span-2">
          <ImageUpload
            label="Shop photo"
            buttonLabel="Upload shop photo"
            helper="This is the photo drivers see on your card and at the top of your public profile. JPG or PNG, up to ~6 MB. We resize automatically."
            value={form.heroImage}
            onChange={(v) => setForm((f) => ({ ...f, heroImage: v }))}
            testId="input-listing-hero"
          />
        </div>
        <label className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${form.dynoAvailable ? "border-primary/40 bg-primary/5" : "border-border bg-card/40"}`}>
          <Checkbox
            checked={form.dynoAvailable}
            onCheckedChange={(v) => setForm((f) => ({ ...f, dynoAvailable: v === true }))}
            data-testid="checkbox-listing-dyno"
          />
          <div className="flex items-center gap-2 text-sm font-medium">
            <Gauge className="h-4 w-4" /> Dyno available
          </div>
        </label>
        <label className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${form.remoteAvailable ? "border-primary/40 bg-primary/5" : "border-border bg-card/40"}`}>
          <Checkbox
            checked={form.remoteAvailable}
            onCheckedChange={(v) => setForm((f) => ({ ...f, remoteAvailable: v === true }))}
            data-testid="checkbox-listing-remote"
          />
          <div className="flex items-center gap-2 text-sm font-medium">
            <Wifi className="h-4 w-4" /> Remote tuning
          </div>
        </label>
      </div>

      <div className="mt-6 flex justify-end">
        <Button
          onClick={() => save.mutate()}
          disabled={save.isPending || !form.shopName.trim() || !form.location.trim()}
          data-testid="button-save-listing"
        >
          {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {isCreate ? "Create profile" : "Save changes"}
        </Button>
      </div>
    </Card>
  );
}

/* ---------------- Phone consultations panel (tuner) ---------------- */

function TunerConsultsPanel() {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const { data: consults, isLoading } = useQuery<any[]>({
    queryKey: ["/api/me/consultations", user?.id],
    queryFn: async () =>
      (await apiRequest("GET", `/api/me/consultations?token=${encodeURIComponent(token!)}`)).json(),
    enabled: !!user && !!token,
  });

  const update = useMutation({
    mutationFn: async (args: { id: number; status: string; tunerPhone?: string; scheduledAt?: string }) => {
      const res = await apiRequest("PATCH", `/api/consultations/${args.id}/status`, {
        token,
        status: args.status,
        tunerPhone: args.tunerPhone,
        scheduledAt: args.scheduledAt,
      });
      return res.json();
    },
    onSuccess: (_d, vars) => {
      toast({
        title: vars.status === "accepted" ? "Consult accepted" : vars.status === "declined" ? "Consult declined" : "Consult updated",
        description: vars.status === "accepted" ? "Driver now sees your number and the scheduled time." : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/me/consultations"] });
    },
    onError: (e: any) =>
      toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if ((consults?.length ?? 0) === 0) {
    return (
      <Card className="p-12 text-center text-muted-foreground">
        <Phone className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3">No phone consultations yet.</p>
        <p className="mt-1 text-sm">Drivers can book a 1-hour phone consult ($125) from your profile. You'll see new requests here.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {consults!.map((c) => (
        <Card key={c.id} className="p-5" data-testid={`card-tuner-consult-${c.id}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{c.driverName || "Driver"} · $125 / 1 hour</div>
              <div className="mt-1 text-sm text-muted-foreground">Topic: {c.topic}</div>
              <div className="mt-1 text-sm text-muted-foreground">Preferred: {c.preferredTime}</div>
              <div className="mt-2 text-sm">
                <span className="text-muted-foreground">Driver phone: </span>
                <a href={`tel:${c.driverPhone}`} className="font-semibold text-primary underline-offset-2 hover:underline" data-testid={`text-driver-phone-${c.id}`}>{c.driverPhone}</a>
              </div>
              {c.scheduledAt && (
                <div className="mt-1 text-sm text-muted-foreground">Scheduled: {c.scheduledAt}</div>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge className={STATUS_COLOR[c.status] || "bg-muted text-foreground"}>{c.status}</Badge>
              {c.status === "requested" && (
                <div className="flex gap-2">
                  <AcceptConsultDialog
                    consultId={c.id}
                    onSubmit={(tunerPhone, scheduledAt) =>
                      update.mutate({ id: c.id, status: "accepted", tunerPhone, scheduledAt })
                    }
                    pending={update.isPending}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => update.mutate({ id: c.id, status: "declined" })}
                    disabled={update.isPending}
                    data-testid={`button-decline-consult-${c.id}`}
                  >
                    <X className="mr-1 h-4 w-4" /> Decline
                  </Button>
                </div>
              )}
              {c.status === "accepted" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => update.mutate({ id: c.id, status: "completed" })}
                  disabled={update.isPending}
                  data-testid={`button-complete-consult-${c.id}`}
                >
                  Mark completed
                </Button>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function AcceptConsultDialog({
  consultId,
  onSubmit,
  pending,
}: {
  consultId: number;
  onSubmit: (tunerPhone: string, scheduledAt: string) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [tunerPhone, setTunerPhone] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (tunerPhone.trim().length < 7 || scheduledAt.trim().length < 2) return;
    onSubmit(tunerPhone.trim(), scheduledAt.trim());
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid={`button-accept-consult-${consultId}`}>
          <CheckCircle2 className="mr-1 h-4 w-4" /> Accept
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Accept consult</DialogTitle>
          <DialogDescription>
            Share your phone number with the driver and confirm when the call will happen. They'll be notified instantly and can reach you at the time below.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`accept-phone-${consultId}`}>Your phone number</Label>
            <Input
              id={`accept-phone-${consultId}`}
              type="tel"
              placeholder="(555) 123-4567"
              value={tunerPhone}
              onChange={(e) => setTunerPhone(e.target.value)}
              data-testid={`input-accept-phone-${consultId}`}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`accept-time-${consultId}`}>Scheduled day & time</Label>
            <Input
              id={`accept-time-${consultId}`}
              placeholder="e.g. Tuesday 7pm EST"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              data-testid={`input-accept-time-${consultId}`}
              required
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending} data-testid={`button-accept-submit-${consultId}`}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Accept & share number
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
