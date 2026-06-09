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
          Tuners pay a flat annual subscription to list. Drivers pay a small service fee at checkout. No hidden costs.
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
            <h2 className="mt-4 font-display text-xl font-bold">Booking service fee</h2>
            <div className="mt-3 flex items-end gap-1">
              <span className="font-display text-5xl font-bold">10%</span>
              <span className="pb-2 text-muted-foreground">per booking</span>
            </div>
            <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
              {["Free to browse and compare tuners", "10% service fee added at checkout", "Service price set by the tuner", "Insurance acknowledgment at booking", "Transparent subtotal + fee + total"].map((f) => (
                <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {f}</li>
              ))}
            </ul>
            <Button variant="outline" className="mt-7 w-full" size="lg" onClick={() => navigate("/tuners")} data-testid="button-pricing-driver">Find a Tuner</Button>
          </Card>
        </div>

        <Card className="mx-auto mt-8 max-w-4xl p-6">
          <h3 className="font-semibold">Example booking math</h3>
          <div className="mt-3 max-w-sm space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Service subtotal</span><span>$450</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Service fee (10%)</span><span>$45</span></div>
            <div className="flex justify-between border-t border-border pt-1 font-semibold"><span>Total</span><span>$495</span></div>
          </div>
        </Card>
      </Section>
    </Layout>
  );
}
