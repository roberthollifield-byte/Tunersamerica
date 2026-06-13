import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Vehicle } from "@shared/schema";
import { Layout, Section } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { usePassStatus, formatPassRemaining } from "@/lib/pass";
import { PromoRedeemBox } from "@/lib/promo";
import { useToast } from "@/hooks/use-toast";
import { Lock, Check, Sparkles } from "lucide-react";
import { money } from "@/lib/format";
import { Car, Calendar, MessageSquare, Plus, Loader2 } from "lucide-react";
import { LeaveReviewDialog } from "@/components/LeaveReviewDialog";

const STATUS_COLOR: Record<string, string> = {
  requested: "bg-amber-500/15 text-amber-400",
  accepted: "bg-primary/15 text-primary",
  in_progress: "bg-blue-500/15 text-blue-400",
  completed: "bg-emerald-500/15 text-emerald-400",
  cancelled: "bg-destructive/15 text-destructive",
};

export default function CustomerDashboard() {
  const { user, token, loginWithToken } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // When Stripe redirects back with ?pass=success, refetch the user so the
  // driver pass shows as active immediately.
  useEffect(() => {
    const hash = window.location.hash || "";
    const qIdx = hash.indexOf("?");
    if (qIdx === -1) return;
    const params = new URLSearchParams(hash.slice(qIdx + 1));
    if (params.get("pass") === "success" && token) {
      const run = async () => {
        await loginWithToken(token);
        queryClient.invalidateQueries();
        toast({ title: "Driver pass active", description: "You can now reach the directory and book tuners." });
        const base = hash.slice(0, qIdx);
        window.history.replaceState(null, "", `${window.location.pathname}${base}`);
      };
      const t = setTimeout(run, 1500);
      return () => clearTimeout(t);
    }
    if (params.get("pass") === "cancelled") {
      toast({ title: "Checkout cancelled", description: "No charge was made.", variant: "destructive" });
      const base = hash.slice(0, qIdx);
      window.history.replaceState(null, "", `${window.location.pathname}${base}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const { data: vehicles, isLoading: vLoading } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles", user?.id],
    queryFn: async () => (await apiRequest("GET", `/api/vehicles?userId=${user!.id}`)).json(),
    enabled: !!user,
  });
  const { data: bookings, isLoading: bLoading } = useQuery<any[]>({
    queryKey: ["/api/bookings", "customer", user?.id],
    queryFn: async () => (await apiRequest("GET", `/api/bookings?customerId=${user!.id}`)).json(),
    enabled: !!user,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ year: "", make: "", model: "", modifications: "", fuelType: "Pump gas" });
  const addVehicle = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/vehicles", { userId: user!.id, ...form, year: Number(form.year) || new Date().getFullYear() })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles", user?.id] });
      setOpen(false);
      setForm({ year: "", make: "", model: "", modifications: "", fuelType: "Pump gas" });
    },
  });

  if (!user) {
    return <Layout><Section><Card className="p-8 text-center"><p className="text-muted-foreground">Please sign in.</p><Button className="mt-4" onClick={() => navigate("/signin")}>Sign in</Button></Card></Section></Layout>;
  }

  return (
    <Layout>
      <Section className="py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">Welcome back, {user.name.split(" ")[0]}</h1>
            <p className="mt-1 text-muted-foreground">Manage your vehicles, bookings, and messages.</p>
          </div>
          <Button onClick={() => navigate("/tuners")} data-testid="button-dash-find">Find a Tuner</Button>
        </div>

        <PassStatusCard />

        <Tabs defaultValue="vehicles" className="mt-8">
          <TabsList>
            <TabsTrigger value="vehicles" data-testid="tab-vehicles"><Car className="mr-2 h-4 w-4" />My Vehicles</TabsTrigger>
            <TabsTrigger value="bookings" data-testid="tab-bookings"><Calendar className="mr-2 h-4 w-4" />Bookings</TabsTrigger>
            <TabsTrigger value="messages" data-testid="tab-messages"><MessageSquare className="mr-2 h-4 w-4" />Messages</TabsTrigger>
          </TabsList>

          {/* Vehicles */}
          <TabsContent value="vehicles" className="mt-6">
            <div className="mb-4 flex justify-end">
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild><Button variant="outline" size="sm" data-testid="button-add-vehicle"><Plus className="mr-2 h-4 w-4" />Add vehicle</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add a vehicle</DialogTitle></DialogHeader>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div><Label>Year</Label><Input className="mt-1.5" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} data-testid="input-add-year" /></div>
                    <div><Label>Make</Label><Input className="mt-1.5" value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} data-testid="input-add-make" /></div>
                    <div><Label>Model</Label><Input className="mt-1.5" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} data-testid="input-add-model" /></div>
                  </div>
                  <div><Label>Modifications</Label><Input className="mt-1.5" value={form.modifications} onChange={(e) => setForm({ ...form, modifications: e.target.value })} data-testid="input-add-mods" /></div>
                  <DialogFooter>
                    <Button onClick={() => addVehicle.mutate()} disabled={!form.make || !form.model || addVehicle.isPending} data-testid="button-save-vehicle">
                      {addVehicle.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save vehicle
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            {vLoading ? <Skeleton className="h-40 w-full" /> : (vehicles?.length ?? 0) === 0 ? (
              <Card className="p-12 text-center text-muted-foreground">No vehicles yet. Add one to speed up booking.</Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {vehicles!.map((v) => (
                  <Card key={v.id} className="p-5" data-testid={`card-vehicle-${v.id}`}>
                    <div className="flex items-center gap-2"><Car className="h-4 w-4 text-primary" /><span className="font-semibold">{v.year} {v.make} {v.model}</span></div>
                    <p className="mt-2 text-sm text-muted-foreground">{v.modifications || "No mods listed"}</p>
                    <Badge variant="secondary" className="mt-3">{v.fuelType}</Badge>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Bookings */}
          <TabsContent value="bookings" className="mt-6">
            {bLoading ? <Skeleton className="h-40 w-full" /> : (bookings?.length ?? 0) === 0 ? (
              <Card className="p-12 text-center text-muted-foreground">No bookings yet. <Button variant="ghost" onClick={() => navigate("/tuners")}>Find a tuner</Button></Card>
            ) : (
              <div className="space-y-3">
                {bookings!.map((b) => (
                  <Card key={b.id} className="flex flex-wrap items-center justify-between gap-4 p-5" data-testid={`card-booking-${b.id}`}>
                    <div>
                      <div className="font-semibold">{b.serviceName ?? "Service"} · {b.shopName}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{b.vehicleLabel} · {money(b.total)} total</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={STATUS_COLOR[b.status]}>{b.status.replace("_", " ")}</Badge>
                      {b.paid ? <Badge variant="outline">Paid</Badge> : <Badge variant="outline">Unpaid</Badge>}
                      {b.status === "completed" && (
                        <LeaveReviewDialog
                          bookingId={b.id}
                          subject={b.shopName || "this tuner"}
                          triggerLabel="Review tuner"
                          invalidateKeys={[["/api/bookings", "customer", user?.id]]}
                        />
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Messages */}
          <TabsContent value="messages" className="mt-6">
            <Card className="p-12 text-center text-muted-foreground">
              <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3">Direct messaging with tuners is coming soon. Bookings carry your goals and notes in the meantime.</p>
            </Card>
          </TabsContent>
        </Tabs>
      </Section>
    </Layout>
  );
}

function PassStatusCard() {
  const { token } = useAuth();
  const { data: pass } = usePassStatus();
  const qc = useQueryClient();
  const { toast } = useToast();
  const buy = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/buyer/pass/checkout", { token });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      qc.invalidateQueries({ queryKey: ["/api/buyer/pass"] });
      qc.invalidateQueries({ queryKey: ["/api/listings"] });
      toast({ title: "Pass active", description: "You now have 30 days of directory access." });
    },
    onError: (e: any) =>
      toast({ title: "Couldn't purchase pass", description: e.message, variant: "destructive" }),
  });

  const active = !!pass?.active;
  return (
    <Card className="mt-6 p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`grid h-10 w-10 place-items-center rounded-full ${active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
            {active ? <Sparkles className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
          </div>
          <div>
            <div className="font-display text-base font-bold">Driver access pass</div>
            <div className="text-sm text-muted-foreground" data-testid="text-pass-status">
              {active ? formatPassRemaining(pass?.passExpiresAt ?? null) : "No active pass — $10 for 30 days of directory access"}
            </div>
          </div>
        </div>
        <Button
          size="sm"
          variant={active ? "outline" : "default"}
          onClick={() => buy.mutate()}
          disabled={buy.isPending}
          data-testid="button-dash-buy-pass"
        >
          {buy.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : active ? <Check className="mr-2 h-4 w-4" /> : null}
          {active ? "Extend 30 days — $10" : "Buy 30-day pass — $10"}
        </Button>
      </div>
      {!active && (
        <div className="mt-4 border-t pt-4">
          <p className="mb-2 text-sm font-medium">Have a promo code?</p>
          <PromoRedeemBox audience="buyer" />
        </div>
      )}
    </Card>
  );
}
