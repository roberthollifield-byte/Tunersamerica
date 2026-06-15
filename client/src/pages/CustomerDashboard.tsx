import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout, Section } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { usePassStatus, formatPassRemaining } from "@/lib/pass";
import { PromoRedeemBox } from "@/lib/promo";
import { useToast } from "@/hooks/use-toast";
import { Lock, Check, Sparkles } from "lucide-react";
import { money } from "@/lib/format";
import { Calendar, MessageSquare, Loader2, Phone } from "lucide-react";
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

  const { data: bookings, isLoading: bLoading } = useQuery<any[]>({
    queryKey: ["/api/bookings", "customer", user?.id],
    queryFn: async () => (await apiRequest("GET", `/api/bookings?customerId=${user!.id}`)).json(),
    enabled: !!user,
  });

  const { data: consults, isLoading: cLoading } = useQuery<any[]>({
    queryKey: ["/api/me/consultations", user?.id],
    queryFn: async () =>
      (await apiRequest("GET", `/api/me/consultations?token=${encodeURIComponent(token!)}`)).json(),
    enabled: !!user && !!token,
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
            <p className="mt-1 text-muted-foreground">Manage your bookings and messages.</p>
          </div>
          <Button onClick={() => navigate("/tuners")} data-testid="button-dash-find">Find a Tuner</Button>
        </div>

        <PassStatusCard />

        <Tabs defaultValue="bookings" className="mt-8">
          <TabsList>
            <TabsTrigger value="bookings" data-testid="tab-bookings"><Calendar className="mr-2 h-4 w-4" />Bookings</TabsTrigger>
            <TabsTrigger value="consults" data-testid="tab-consults"><Phone className="mr-2 h-4 w-4" />Phone Consults</TabsTrigger>
            <TabsTrigger value="messages" data-testid="tab-messages"><MessageSquare className="mr-2 h-4 w-4" />Messages</TabsTrigger>
          </TabsList>

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

          {/* Phone consultations */}
          <TabsContent value="consults" className="mt-6">
            {cLoading ? <Skeleton className="h-40 w-full" /> : (consults?.length ?? 0) === 0 ? (
              <Card className="p-12 text-center text-muted-foreground">
                <Phone className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3">No phone consultations yet.</p>
                <p className="mt-1 text-sm">Open a tuner's profile and tap "$125 · 1-hour phone consult" to request one.</p>
                <Button variant="ghost" className="mt-3" onClick={() => navigate("/tuners")}>Find a tuner</Button>
              </Card>
            ) : (
              <div className="space-y-3">
                {consults!.map((c) => (
                  <Card key={c.id} className="p-5" data-testid={`card-consult-${c.id}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">{c.shopName || c.tunerName || "Tuner"} · $125 / 1 hour</div>
                        <div className="mt-1 text-sm text-muted-foreground">Topic: {c.topic}</div>
                        <div className="mt-1 text-sm text-muted-foreground">Preferred: {c.preferredTime}</div>
                        {c.tunerPhone && c.status === "accepted" && (
                          <div className="mt-2 text-sm">
                            <span className="text-muted-foreground">Call them at: </span>
                            <a href={`tel:${c.tunerPhone}`} className="font-semibold text-primary underline-offset-2 hover:underline" data-testid={`text-tuner-phone-${c.id}`}>{c.tunerPhone}</a>
                          </div>
                        )}
                        {c.scheduledAt && c.status === "accepted" && (
                          <div className="mt-1 text-sm text-muted-foreground">Scheduled: {c.scheduledAt}</div>
                        )}
                      </div>
                      <Badge className={STATUS_COLOR[c.status] || "bg-muted text-foreground"}>{c.status}</Badge>
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
