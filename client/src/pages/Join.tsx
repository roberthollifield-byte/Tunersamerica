import { useLocation } from "wouter";
import { Layout, Section, Eyebrow } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowRight } from "lucide-react";
import shop from "@/assets/tuner-shop.png";

const BENEFITS = [
  "A polished public listing with your specialties, supported makes, and gallery",
  "Qualified bookings from drivers who already know what they need",
  "Service & pricing management from a dedicated dashboard",
  "Booking pipeline with status tracking (requested → completed)",
  "Earnings overview and Stripe Connect payouts",
  "Dyno and remote availability badges to match the right work",
];

export default function Join() {
  const [, navigate] = useLocation();
  return (
    <Layout>
      <Section className="pb-8 pt-12">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <Eyebrow>For tuners</Eyebrow>
            <h1 className="mt-4 font-display text-4xl font-bold md:text-5xl">List your shop. Get matched with the right builds.</h1>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">
              TunersAmerica puts your shop in front of drivers actively searching for your platform and your
              services — for a flat <span className="font-semibold text-foreground">$99/year</span>.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => navigate("/signin?role=tuner")} data-testid="button-join-signup">
                Sign up as a Tuner <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/pricing")} data-testid="button-join-pricing">See pricing</Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-card-border">
            <img src={shop} alt="Tuner working on an engine" className="h-72 w-full object-cover" />
          </div>
        </div>
      </Section>

      <Section className="pt-0">
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <Card className="p-7">
            <h2 className="font-display text-xl font-bold">What you get</h2>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {BENEFITS.map((b) => (
                <li key={b} className="flex gap-2 text-sm text-muted-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {b}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-7">
            <Badge className="bg-primary/15 text-primary">Host subscription</Badge>
            <div className="mt-3 flex items-end gap-1">
              <span className="font-display text-4xl font-bold">$99</span>
              <span className="pb-1 text-muted-foreground">/ year</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Your listing stays visible while your subscription is active. A 10% customer service fee is added at booking checkout.
            </p>
            <Button className="mt-5 w-full" size="lg" onClick={() => navigate("/signin?role=tuner")} data-testid="button-join-start">Get started</Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">No charge in demo mode — Stripe is stubbed.</p>
          </Card>
        </div>
      </Section>
    </Layout>
  );
}
