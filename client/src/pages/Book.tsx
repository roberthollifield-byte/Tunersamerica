import { useState, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { ListingWithDetails, Vehicle } from "@shared/schema";
import { Layout, Section, Eyebrow } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { usePassGate, PassPaywall } from "@/lib/pass";
import { useToast } from "@/hooks/use-toast";
import { money, CATEGORY_LABELS } from "@/lib/format";
import { Check, ShieldAlert, Loader2, ArrowRight, PartyPopper } from "lucide-react";

export default function Book() {
  const [, params] = useRoute("/book/:id");
  const [, navigate] = useLocation();
  const { user, token } = useAuth();
  const { hasAccess, isLoading: gateLoading } = usePassGate();
  const { toast } = useToast();
  const id = Number(params?.id);

  const { data: listing, isLoading } = useQuery<ListingWithDetails>({
    queryKey: ["/api/listings", id, token],
    enabled: hasAccess && !!token && !!id,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/listings/${id}?token=${encodeURIComponent(token!)}`);
      return res.json();
    },
  });
  const { data: vehicles } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles", user?.id],
    queryFn: async () => (await apiRequest("GET", `/api/vehicles?userId=${user!.id}`)).json(),
    enabled: !!user,
  });

  const [serviceId, setServiceId] = useState<string>("");
  const [vehicleId, setVehicleId] = useState<string>("");
  // new vehicle quick-add
  const [newYear, setNewYear] = useState("");
  const [newMake, setNewMake] = useState("");
  const [newModel, setNewModel] = useState("");
  const [mods, setMods] = useState("");
  const [fuel, setFuel] = useState("Pump gas");
  const [goals, setGoals] = useState("");
  const [ack, setAck] = useState(false);
  const [done, setDone] = useState<{ total: number } | null>(null);

  const selectedService = listing?.services.find((s) => String(s.id) === serviceId);
  const subtotal = selectedService?.price ?? listing?.startingPrice ?? 0;
  // No platform fee — buyer & tuner arrange payment directly.
  const total = subtotal;

  const createVehicle = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/vehicles", {
        userId: user!.id,
        year: Number(newYear) || new Date().getFullYear(),
        make: newMake,
        model: newModel,
        modifications: mods,
        fuelType: fuel,
      });
      return res.json() as Promise<Vehicle>;
    },
  });

  const book = useMutation({
    mutationFn: async () => {
      let vId = vehicleId ? Number(vehicleId) : null;
      if (!vId) {
        const v = await createVehicle.mutateAsync();
        vId = v.id;
      }
      const res = await apiRequest("POST", "/api/bookings", {
        customerId: user!.id,
        listingId: id,
        serviceId: selectedService?.id ?? null,
        vehicleId: vId,
        subtotal,
        insuranceAcknowledged: true,
        notes: goals,
        token,
      });
      return res.json();
    },
    onSuccess: (b) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      setDone({ total: b.total });
    },
    onError: (e: any) => toast({ title: "Booking failed", description: e.message, variant: "destructive" }),
  });

  if (!user) {
    return (
      <Layout><Section><Card className="p-8 text-center">
        <p className="text-muted-foreground">Please sign in to book a service.</p>
        <Button className="mt-4" onClick={() => navigate(`/signin?redirect=/book/${id}`)} data-testid="button-book-signin">Sign in</Button>
      </Card></Section></Layout>
    );
  }
  if (!hasAccess && !gateLoading) {
    return <Layout><Section className="py-16"><PassPaywall /></Section></Layout>;
  }
  if (isLoading || gateLoading) return <Layout><Section><Skeleton className="h-96 w-full" /></Section></Layout>;
  if (!listing) return <Layout><Section><h1 className="font-display text-2xl font-bold">Tuner not found</h1></Section></Layout>;

  if (done) {
    return (
      <Layout>
        <Section className="flex flex-col items-center py-20 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/15 text-primary"><PartyPopper className="h-8 w-8" /></div>
          <h1 className="mt-5 font-display text-3xl font-bold">Booking confirmed</h1>
          <p className="mt-2 max-w-md text-muted-foreground">
            Your request was sent to <span className="font-medium text-foreground">{listing.shopName}</span>. Service total {money(done.total)} — the tuner will follow up to arrange payment directly.
          </p>
          <div className="mt-6 flex gap-3">
            <Button onClick={() => navigate("/dashboard/customer")} data-testid="button-view-bookings">View my bookings</Button>
            <Button variant="outline" onClick={() => navigate("/tuners")} data-testid="button-book-more">Browse more tuners</Button>
          </div>
        </Section>
      </Layout>
    );
  }

  const needNewVehicle = !vehicleId;

  return (
    <Layout>
      <Section className="py-12">
        <Eyebrow>Book a service</Eyebrow>
        <h1 className="mt-4 font-display text-3xl font-bold md:text-4xl">{listing.shopName}</h1>
        <p className="mt-2 text-muted-foreground">{listing.location}</p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          {/* Intake */}
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="font-display text-lg font-bold">1. Choose a service</h2>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger className="mt-3" data-testid="select-book-service"><SelectValue placeholder="Select a service" /></SelectTrigger>
                <SelectContent>
                  {listing.services.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name} — {money(s.price)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedService && (
                <div className="mt-3 flex items-center gap-2">
                  <Badge variant="outline">{CATEGORY_LABELS[selectedService.category]}</Badge>
                  <span className="text-sm text-muted-foreground">{selectedService.description}</span>
                </div>
              )}
            </Card>

            <Card className="p-6">
              <h2 className="font-display text-lg font-bold">2. Your vehicle</h2>
              {vehicles && vehicles.length > 0 && (
                <div className="mt-3">
                  <Label className="text-xs text-muted-foreground">Saved vehicles</Label>
                  <Select value={vehicleId} onValueChange={setVehicleId}>
                    <SelectTrigger className="mt-1.5" data-testid="select-book-vehicle"><SelectValue placeholder="Select a vehicle" /></SelectTrigger>
                    <SelectContent>
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={String(v.id)}>{v.year} {v.make} {v.model}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {needNewVehicle && (
                <div className="mt-4 space-y-4 border-t border-border pt-4">
                  <div className="text-xs text-muted-foreground">Or add a new vehicle</div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div><Label htmlFor="b-year">Year</Label><Input id="b-year" className="mt-1.5" placeholder="2019" value={newYear} onChange={(e) => setNewYear(e.target.value)} data-testid="input-vehicle-year" /></div>
                    <div><Label htmlFor="b-make">Make</Label><Input id="b-make" className="mt-1.5" placeholder="Chevrolet" value={newMake} onChange={(e) => setNewMake(e.target.value)} data-testid="input-vehicle-make" /></div>
                    <div><Label htmlFor="b-model">Model</Label><Input id="b-model" className="mt-1.5" placeholder="Camaro SS" value={newModel} onChange={(e) => setNewModel(e.target.value)} data-testid="input-vehicle-model" /></div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><Label htmlFor="b-mods">Modifications</Label><Input id="b-mods" className="mt-1.5" placeholder="Headers, intake, 93 oct" value={mods} onChange={(e) => setMods(e.target.value)} data-testid="input-vehicle-mods" /></div>
                    <div><Label htmlFor="b-fuel">Fuel type</Label><Input id="b-fuel" className="mt-1.5" value={fuel} onChange={(e) => setFuel(e.target.value)} data-testid="input-vehicle-fuel" /></div>
                  </div>
                </div>
              )}
            </Card>

            <Card className="p-6">
              <h2 className="font-display text-lg font-bold">3. Goals & notes</h2>
              <Textarea className="mt-3 min-h-28" placeholder="What are you trying to fix or improve?" value={goals} onChange={(e) => setGoals(e.target.value)} data-testid="input-book-goals" />
            </Card>
          </div>

          {/* Summary */}
          <div>
            <Card className="p-6 lg:sticky lg:top-24">
              <h2 className="font-display text-lg font-bold">Review & confirm</h2>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Service</span><span className="text-right font-medium">{selectedService?.name ?? "Starting service"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Service price</span><span data-testid="text-subtotal">{money(subtotal)}</span></div>
                <div className="flex justify-between text-xs text-muted-foreground"><span>Platform fee</span><span data-testid="text-service-fee">$0 (paid via $10 pass)</span></div>
                <div className="flex justify-between border-t border-border pt-2 text-base font-bold"><span>You owe the tuner</span><span data-testid="text-total">{money(total)}</span></div>
                <p className="pt-1 text-xs text-muted-foreground">Payment is arranged directly with the tuner after they accept your request.</p>
              </div>

              <div className="mt-5 flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3">
                <Checkbox id="ack" checked={ack} onCheckedChange={(v) => setAck(!!v)} className="mt-0.5" data-testid="checkbox-insurance" />
                <Label htmlFor="ack" className="text-xs leading-relaxed text-muted-foreground">
                  <span className="flex items-center gap-1 font-medium text-foreground"><ShieldAlert className="h-3.5 w-3.5 text-primary" /> Insurance acknowledgment</span>
                  I understand tuning modifies vehicle behavior and accept the associated risks and insurance considerations for this service.
                </Label>
              </div>

              <Button
                className="mt-5 w-full"
                size="lg"
                disabled={!ack || !selectedService || book.isPending || (needNewVehicle && (!newMake || !newModel))}
                onClick={() => book.mutate()}
                data-testid="button-confirm-booking"
              >
                {book.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Confirm booking
              </Button>
              {!selectedService && <p className="mt-2 text-center text-xs text-muted-foreground">Select a service to continue.</p>}
              {!ack && <p className="mt-2 text-center text-xs text-muted-foreground">Insurance acknowledgment is required.</p>}
            </Card>
          </div>
        </div>
      </Section>
    </Layout>
  );
}
