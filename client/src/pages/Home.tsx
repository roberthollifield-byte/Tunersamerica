import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { ListingWithDetails } from "@shared/schema";
import { Layout, Section, Eyebrow } from "@/components/Layout";
import { TunerCard } from "@/components/TunerCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PLATFORMS, CATEGORY_LABELS } from "@/lib/format";
import {
  Wifi, Gauge, Stethoscope, Cpu, Cog, Wrench, Flag, ShieldCheck, Search,
  Star, ArrowRight, BadgeCheck, Quote,
} from "lucide-react";
import dyno from "@/assets/hero-dyno.png";
import ecu from "@/assets/hero-ecu.png";

const SERVICES = [
  { icon: Wifi, name: "Remote tuning", desc: "File reads, datalog review, revisions, and final tune delivery — wherever your car lives." },
  { icon: Gauge, name: "Dyno tuning", desc: "Dial in power, response, and drivability with measured in-person calibration work." },
  { icon: Stethoscope, name: "Diagnostics", desc: "Get help reviewing logs, chasing faults, and correcting drivability problems." },
  { icon: Cpu, name: "ECU / TCM calibration", desc: "Specialists for engine and transmission tuning on supported modules and platforms." },
  { icon: Wrench, name: "Build support", desc: "Injectors, boost, fuel changes, and hardware-specific guidance from start to finish." },
  { icon: Flag, name: "Street & race setups", desc: "Daily drivers, track builds, drag cars, and dedicated race calibrations." },
];

function SearchShell() {
  const [, navigate] = useLocation();
  const [make, setMake] = useState("");
  const [service, setService] = useState("");
  const [mode, setMode] = useState("");
  function submit() {
    const params = new URLSearchParams();
    if (make) params.set("make", make);
    if (service) params.set("service", service);
    if (mode) params.set("mode", mode);
    navigate(`/tuners${params.toString() ? "?" + params.toString() : ""}`);
  }
  return (
    <Card className="tl-glass p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold">Find a specialist</div>
          <div className="text-sm text-muted-foreground">Search by vehicle, service, and availability</div>
        </div>
        <Badge className="bg-primary/15 text-primary">Fast match</Badge>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Select value={make} onValueChange={setMake}>
          <SelectTrigger data-testid="select-home-make"><SelectValue placeholder="Make" /></SelectTrigger>
          <SelectContent>
            {PLATFORMS.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input placeholder="Model / Year" data-testid="input-home-model" />
        <Select value={service} onValueChange={setService}>
          <SelectTrigger data-testid="select-home-service"><SelectValue placeholder="Service needed" /></SelectTrigger>
          <SelectContent>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={mode} onValueChange={setMode}>
          <SelectTrigger data-testid="select-home-mode"><SelectValue placeholder="Remote or in-person" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="remote">Remote</SelectItem>
            <SelectItem value="dyno">In-person / dyno</SelectItem>
            <SelectItem value="either">Either</SelectItem>
          </SelectContent>
        </Select>
        <Input placeholder="Location (city or ZIP)" className="sm:col-span-2" data-testid="input-home-location" />
      </div>
      <Button className="mt-4 w-full" onClick={submit} data-testid="button-search-tuners">
        <Search className="mr-2 h-4 w-4" /> Search Tuners
      </Button>
    </Card>
  );
}

export default function Home() {
  const [, navigate] = useLocation();
  const { data: listings, isLoading } = useQuery<ListingWithDetails[]>({ queryKey: ["/api/listings"] });
  const featured = (listings ?? []).slice(0, 3);
  const trust = [
    "Verified tuner profiles with clear specialties.",
    "Remote options for file-based tuning and revisions.",
    "In-person dyno and diagnostics for serious setups.",
    "Built for real projects, daily drivers to race cars.",
  ];

  return (
    <Layout>
      {/* HERO */}
      <Section className="pb-6 pt-10 md:pt-16">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <Eyebrow>Remote + in-person tuning</Eyebrow>
            <h1 className="mt-5 max-w-[12ch] font-display text-5xl font-extrabold leading-[0.95] tracking-tight md:text-6xl" data-testid="text-hero-title">
              Find the right tuner for your build.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              Connect with verified automotive tuners for remote tuning, dyno sessions, diagnostics,
              ECU calibration, transmission tuning, and platform-specific performance help.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => navigate("/tuners")} data-testid="button-hero-find">
                Find a Tuner <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/join")} data-testid="button-hero-join">
                Join as a Tuner
              </Button>
            </div>
            <div className="mt-8 grid grid-cols-3 gap-3">
              {[["Remote", "Tune revisions & datalog review"], ["Dyno", "Measured in-person calibration"], ["Verified", "Vehicle & service specialties"]].map(([t, d]) => (
                <div key={t} className="rounded-lg border border-border bg-card/40 p-3">
                  <div className="font-display font-bold">{t}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{d}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="overflow-hidden rounded-2xl border border-card-border">
              <img src={dyno} alt="Performance car on a chassis dyno" className="h-56 w-full object-cover md:h-64" />
            </div>
            <div className="mt-4"><SearchShell /></div>
          </div>
        </div>
        <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {trust.map((t) => (
            <div key={t} className="flex items-start gap-2 bg-background p-4 text-sm text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {t}
            </div>
          ))}
        </div>
      </Section>

      {/* DUAL AUDIENCE */}
      <Section className="py-10">
        <Eyebrow>Two-sided marketplace</Eyebrow>
        <h2 className="mt-4 font-display text-3xl font-bold md:text-4xl">Built for drivers and tuners.</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <Card className="p-7">
            <h3 className="font-display text-xl font-bold">Need tuning help?</h3>
            <p className="mt-3 text-muted-foreground">
              Tell us what you drive, what's been done to the car, and what you want out of it. Compare
              tuners for remote support, dyno tuning, drivability fixes, diagnostics, and full calibration.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Vehicle fitment", "Remote tuning", "Dyno sessions"].map((c) => (
                <Badge key={c} variant="secondary">{c}</Badge>
              ))}
            </div>
            <Button className="mt-5" onClick={() => navigate("/tuners")} data-testid="button-browse-tuners">Browse Tuners</Button>
          </Card>
          <Card className="p-7">
            <h3 className="font-display text-xl font-bold">Run a tuning shop?</h3>
            <p className="mt-3 text-muted-foreground">
              Create a profile, list your specialties, and connect with drivers looking for exactly what you
              offer. Show supported vehicles, tools, turnaround times, and expertise in one clean listing.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Qualified leads", "Platform specialties", "Service badges"].map((c) => (
                <Badge key={c} variant="secondary">{c}</Badge>
              ))}
            </div>
            <Button className="mt-5" variant="outline" onClick={() => navigate("/join")} data-testid="button-create-profile">Create Your Profile</Button>
          </Card>
        </div>
      </Section>

      {/* FEATURED TUNERS */}
      <Section className="py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Featured tuners</Eyebrow>
            <h2 className="mt-4 font-display text-3xl font-bold md:text-4xl">Explore shops by specialty.</h2>
          </div>
          <Button variant="ghost" onClick={() => navigate("/tuners")} data-testid="button-view-all-tuners">
            View all <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading
            ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-80 rounded-xl" />)
            : featured.map((l) => <TunerCard key={l.id} listing={l} />)}
        </div>
      </Section>

      {/* SERVICES GRID */}
      <Section className="py-10">
        <Eyebrow>Core services</Eyebrow>
        <h2 className="mt-4 font-display text-3xl font-bold md:text-4xl">Services drivers actually search for.</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s) => (
            <Card key={s.name} className="p-6 hover-elevate">
              <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary/15 text-primary">
                <s.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold">{s.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* HOW IT WORKS */}
      <Section className="py-10">
        <Eyebrow>How it works</Eyebrow>
        <h2 className="mt-4 font-display text-3xl font-bold md:text-4xl">Simple for both sides.</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {[
            { title: "For drivers", steps: ["Enter your vehicle, mods, goals, and preferred service type.", "Compare tuners by specialty, location, and remote or in-person availability.", "Book a service, acknowledge the terms, and get matched with the right expert."] },
            { title: "For tuners", steps: ["Build a profile and list supported makes, models, and services.", "Subscribe for $99/year to make your listing visible to drivers.", "Receive qualified bookings and manage everything from your dashboard."] },
          ].map((col) => (
            <Card key={col.title} className="p-7">
              <h3 className="font-display text-lg font-bold">{col.title}</h3>
              <ol className="mt-4 space-y-4">
                {col.steps.map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">{i + 1}</span>
                    <span className="text-sm text-muted-foreground">{s}</span>
                  </li>
                ))}
              </ol>
            </Card>
          ))}
        </div>
      </Section>

      {/* PLATFORMS */}
      <Section className="py-10">
        <Eyebrow>Browse by platform</Eyebrow>
        <h2 className="mt-4 font-display text-3xl font-bold md:text-4xl">Tuners for your make.</h2>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PLATFORMS.map((p) => (
            <Link key={p.key} href={`/tuners?make=${p.key}`} data-testid={`link-platform-${p.key}`}>
              <Card className="p-5 hover-elevate">
                <div className="font-display font-bold">{p.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">{p.blurb}</div>
              </Card>
            </Link>
          ))}
        </div>
      </Section>

      {/* TESTIMONIALS */}
      <Section className="py-10">
        <Eyebrow>Results that matter</Eyebrow>
        <h2 className="mt-4 font-display text-3xl font-bold md:text-4xl">Proof for serious builds.</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {[
            { q: "I needed remote tuning help for a modified street car and found someone who knew my platform right away. The revisions were quick and the car finally drives the way it should.", a: "Street build owner" },
            { q: "We were looking for a dyno tuner who understood our combination and fuel setup. We found a shop that matched the build and saved us a lot of time.", a: "Track build customer" },
          ].map((t) => (
            <Card key={t.a} className="p-7">
              <Quote className="h-6 w-6 text-primary" />
              <p className="mt-4 text-muted-foreground">"{t.q}"</p>
              <div className="mt-4 flex items-center gap-2 text-sm font-semibold">
                <BadgeCheck className="h-4 w-4 text-primary" /> {t.a}
              </div>
            </Card>
          ))}
        </div>
      </Section>

      {/* FINAL CTA */}
      <Section className="pb-20 pt-6">
        <div className="relative overflow-hidden rounded-2xl border border-card-border p-8 md:p-12">
          <img src={ecu} alt="ECU calibration session" className="absolute inset-0 h-full w-full object-cover opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/50" />
          <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="max-w-xl">
              <h2 className="font-display text-3xl font-bold md:text-4xl">Built to connect the right cars with the right tuners.</h2>
              <p className="mt-3 text-muted-foreground">
                Search by vehicle and service, or create a profile and start connecting with drivers who need your expertise.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" onClick={() => navigate("/tuners")} data-testid="button-cta-find">Find a Tuner</Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/join")} data-testid="button-cta-list">List Your Shop</Button>
            </div>
          </div>
        </div>
      </Section>
    </Layout>
  );
}
