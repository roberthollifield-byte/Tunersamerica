import { useLocation } from "wouter";
import { Layout, Section, Eyebrow } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wifi, Gauge, Stethoscope, Cpu, Cog, Wrench, Flag, ArrowRight } from "lucide-react";
import ecu from "@/assets/hero-ecu.png";

const CATS = [
  { icon: Wifi, name: "Remote tuning", blurb: "Work with a tuner through file reads, datalog review, revisions, and final tune delivery — no matter where your car lives.", points: ["HP Tuners, COBB, MHD, bootmod3 workflows", "Datalog-driven revisions", "Unlimited revisions windows on many packages"] },
  { icon: Gauge, name: "Dyno tuning", blurb: "Dial in power, response, and drivability with measured in-person calibration on a chassis dynamometer.", points: ["Load-bearing & inertia dyno sessions", "WOT and part-throttle calibration", "Before/after pulls and printouts"] },
  { icon: Stethoscope, name: "Diagnostics", blurb: "Get help reviewing logs, identifying issues, and correcting drivability or performance problems.", points: ["Knock, AFR & boost-control analysis", "Written action plans", "Pre-tune health checks"] },
  { icon: Cpu, name: "ECU calibration", blurb: "Engine control calibration for supported modules across street and performance applications.", points: ["Bench & OBD flashing", "Fueling and timing strategy", "Safety thresholds & failsafes"] },
  { icon: Cog, name: "TCM calibration", blurb: "Transmission control tuning for faster, firmer, more reliable shifts under added power.", points: ["Shift firmness & timing", "Raised torque limits", "Launch control & line pressure"] },
  { icon: Wrench, name: "Build support", blurb: "End-to-end guidance for injectors, boost, fueling, and hardware-specific requirements.", points: ["Parts compatibility planning", "Base maps for new combos", "Staged build roadmaps"] },
  { icon: Flag, name: "Race setups", blurb: "Track-focused calibrations with multiple maps, fuel strategy, and safety thresholds.", points: ["Multi-map configurations", "Race fuel & E85 blends", "Data review between sessions"] },
];

export default function Services() {
  const [, navigate] = useLocation();
  return (
    <Layout>
      <Section className="pb-8 pt-12">
        <Eyebrow>Core services</Eyebrow>
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold md:text-5xl">Every service a serious build needs.</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          TuneLink tuners cover the full spectrum of modern calibration work — from remote file tuning to
          in-person dyno sessions, diagnostics, and dedicated race support.
        </p>
      </Section>

      <Section className="pt-0">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {CATS.map((c) => (
            <Card key={c.name} className="flex flex-col p-6 hover-elevate">
              <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary/15 text-primary">
                <c.icon className="h-5 w-5" />
              </div>
              <h2 className="mt-4 font-display text-lg font-bold">{c.name}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{c.blurb}</p>
              <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                {c.points.map((p) => (
                  <li key={p} className="flex gap-2"><span className="text-primary">•</span>{p}</li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </Section>

      <Section className="pb-20">
        <div className="relative overflow-hidden rounded-2xl border border-card-border p-8 md:p-12">
          <img src={ecu} alt="ECU calibration" className="absolute inset-0 h-full w-full object-cover opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/50" />
          <div className="relative max-w-xl">
            <h2 className="font-display text-3xl font-bold">Not sure which service you need?</h2>
            <p className="mt-3 text-muted-foreground">Browse tuners and filter by service type — the right specialist will help you scope the work.</p>
            <Button size="lg" className="mt-5" onClick={() => navigate("/tuners")} data-testid="button-services-find">
              Find a Tuner <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </Section>
    </Layout>
  );
}
