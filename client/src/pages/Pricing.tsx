import { useLocation } from "wouter";
import { Layout, Section, Eyebrow } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

export default function Pricing() {
  const [, navigate] = useLocation();
  return (
    <Layout>
      <Section className="pb-8 pt-12 text-center">
        <Eyebrow>Pricing</Eyebrow>
        <h1 className="mx-auto mt-4 max-w-3xl font-display text-4xl font-bold md:text-5xl">Simple, transparent pricing.</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Tuners pay a flat annual subscription to list. Drivers pay $10 for a 30-day access pass. No platform fee on bookings — tuners keep 100% of their service price.
        </p>
      </Section>

      <Section className="pt-0">
        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
          {/* Tuners */}
          <Card className="relative p-8">
            <Badge className="bg-primary/15 text-primary">For tuners</Badge>
            <h2 className="mt-4 font-display text-xl font-bold">Host subscription</h2>
            <div className="mt-3 flex items-end gap-1">
              <span className="font-display text-5xl font-bold">$99</span>
              <span className="pb-2 text-muted-foreground">/ year</span>
            </div>
            <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
              {["Public listing visible while active", "Unlimited services & pricing", "Booking pipeline + earnings view", "Stripe Connect payouts", "Dyno & remote availability badges"].map((f) => (
                <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {f}</li>
              ))}
            </ul>
            <Button className="mt-7 w-full" size="lg" onClick={() => navigate("/signin?role=tuner")} data-testid="button-pricing-tuner">Join as a Tuner</Button>
          </Card>

          {/* Drivers */}
          <Card className="p-8">
            <Badge variant="secondary">For drivers</Badge>
            <h2 className="mt-4 font-display text-xl font-bold">30-day buyer pass</h2>
            <div className="mt-3 flex items-end gap-1">
              <span className="font-display text-5xl font-bold">$10</span>
              <span className="pb-2 text-muted-foreground">/ 30 days</span>
            </div>
            <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
              {["Browse every verified tuner for 30 days", "Send unlimited booking requests", "No platform fee — tuners keep 100%", "Service price set by the tuner", "Payment arranged directly with the tuner"].map((f) => (
                <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {f}</li>
              ))}
            </ul>
            <Button variant="outline" className="mt-7 w-full" size="lg" onClick={() => navigate("/tuners")} data-testid="button-pricing-driver">Find a Tuner</Button>
          </Card>
        </div>

        <Card className="mx-auto mt-8 max-w-4xl p-6">
          <h3 className="font-semibold">Example: a $450 remote tune</h3>
          <div className="mt-3 max-w-sm space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Buyer pass (30 days)</span><span>$10</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Service price (paid to tuner)</span><span>$450</span></div>
            <div className="flex justify-between border-t border-border pt-1 font-semibold"><span>Total out of pocket</span><span>$460</span></div>
            <div className="pt-2 text-xs text-muted-foreground">Tuner receives the full $450. TunersAmerica takes no cut of the service.</div>
          </div>
        </Card>
      </Section>
    </Layout>
  );
}
