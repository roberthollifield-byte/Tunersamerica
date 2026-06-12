import { useLocation } from "wouter";
import { Layout, Section, Eyebrow } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Car, Wrench } from "lucide-react";

const DRIVER = [
  { t: "Tell us about your build", d: "Enter your vehicle, current modifications, fuel type, and what you want to improve." },
  { t: "Compare specialists", d: "Filter tuners by platform, service type, location, and remote or in-person availability." },
  { t: "Book & acknowledge terms", d: "Buy your $10 / 30-day buyer pass, pick a service, accept the insurance acknowledgment, and send the request. Tuners keep 100%." },
];
const TUNER = [
  { t: "Create your listing", d: "Add your shop, supported makes, services, pricing, and whether you offer dyno or remote work." },
  { t: "Subscribe for $99/year", d: "Activate your subscription to make your listing visible to drivers searching the marketplace." },
  { t: "Manage bookings", d: "Receive qualified bookings, track earnings, and connect Stripe to get paid — all from your dashboard." },
];

function Flow({ title, icon: Icon, steps, accent }: { title: string; icon: any; steps: { t: string; d: string }[]; accent: string }) {
  return (
    <Card className="p-7">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary/15 text-primary"><Icon className="h-5 w-5" /></div>
        <h2 className="font-display text-xl font-bold">{title}</h2>
      </div>
      <ol className="mt-6 space-y-6">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
            <div>
              <div className="font-semibold">{s.t}</div>
              <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export default function HowItWorks() {
  const [, navigate] = useLocation();
  return (
    <Layout>
      <Section className="pb-8 pt-12">
        <Eyebrow>How it works</Eyebrow>
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold md:text-5xl">A clear path for both sides of the garage.</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          TunersAmerica follows a dual-audience marketplace model: one simple flow for drivers who need tuning
          help, and another for shops that want qualified leads.
        </p>
      </Section>
      <Section className="pt-0">
        <div className="grid gap-6 md:grid-cols-2">
          <Flow title="For drivers" icon={Car} steps={DRIVER} accent="primary" />
          <Flow title="For tuners" icon={Wrench} steps={TUNER} accent="primary" />
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button size="lg" onClick={() => navigate("/tuners")} data-testid="button-how-find">Find a Tuner</Button>
          <Button size="lg" variant="outline" onClick={() => navigate("/join")} data-testid="button-how-join">Join as a Tuner</Button>
        </div>
      </Section>
    </Layout>
  );
}
