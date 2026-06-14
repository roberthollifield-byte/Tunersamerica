import { useState } from "react";
import { useLocation } from "wouter";
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
import { CATEGORY_LABELS } from "@/lib/format";
import {
  Wifi, Gauge, Stethoscope, Cpu, Cog, Wrench, Flag, ShieldCheck, Search,
  Star, ArrowRight, BadgeCheck, Quote,
} from "lucide-react";
import { HeroSlideshow } from "@/components/HeroSlideshow";
import ecu from "@/assets/hero-ecu.png";
import { DISTANCE_OPTIONS } from "@/lib/distance";

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
  const [service, setService] = useState("");
  const [mode, setMode] = useState("");
  const [zip, setZip] = useState("");
  const [radius, setRadius] = useState("100");
  function submit() {
    const params = new URLSearchParams();
    if (service) params.set("service", service);
    if (mode) params.set("mode", mode);
    if (zip.trim()) params.set("zip", zip.trim());
    if (radius) params.set("radius", radius);
    navigate(`/tuners${params.toString() ? "?" + params.toString() : ""}`);
  }
  return (
    <Card className="tl-glass p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold">Find a specialist</div>
          <div className="text-sm text-muted-foreground">Search by service and distance</div>
        </div>
        <Badge className="bg-primary/15 text-primary">Fast match</Badge>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
        <Input
          placeholder="Your ZIP code"
          inputMode="numeric"
          maxLength={5}
          value={zip}
          onChange={(e) => setZip(e.target.value.replace(/[^0-9]/g, ""))}
          data-testid="input-home-zip"
        />
        <Select value={radius} onValueChange={setRadius}>
          <SelectTrigger data-testid="select-home-radius"><SelectValue placeholder="Distance" /></SelectTrigger>
          <SelectContent>
            {DISTANCE_OPTIONS.map((d) => (
              <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
            <h1 className="mt-5 max-w-[14ch] font-display text-5xl font-extrabold leading-[0.95] tracking-tight md:text-6xl" data-testid="text-hero-title">
              Find a tuner near you.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              TunersAmerica is the nationwide marketplace for verified automotive tuners. Search by
              ZIP and distance, compare dyno tuning, remote ECU tuning, diesel, and drag-race specialists,
              read real reviews, and book online.
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
            <HeroSlideshow />
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
              Tell us what service you need and where you are. Compare tuners for remote support,
              dyno tuning, drivability fixes, diagnostics, and full calibration.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Remote tuning", "Dyno sessions", "Diagnostics"].map((c) => (
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

      {/* FAQ — high-intent answers that both help drivers and feed Google rich-result snippets. */}
      <Section className="py-10">
        <Eyebrow>Common questions</Eyebrow>
        <h2 className="mt-4 font-display text-3xl font-bold md:text-4xl">How TunersAmerica works.</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {[
            {
              q: "How do I find a tuner near me?",
              a: "Enter your ZIP code on the Find a Tuner page and choose a search radius (25, 50, 100, 250 miles, or anywhere). We\u2019ll show every verified tuner within range, sorted by distance, with their tuning types, supported platforms, and reviews.",
            },
            {
              q: "What kinds of tuning can I book?",
              a: "Dyno tuning, street tuning, track-day tuning, and remote ECU tuning. Tuners on the platform also list their supported makes, engines, fuel types, transmissions, and forced-induction experience so you can match the right shop to your build.",
            },
            {
              q: "Are the tuners verified?",
              a: "Yes. Every tuner on TunersAmerica goes through a vetting process before their listing is published. We confirm their shop, supported platforms, and capabilities. Reviews come from real customers who completed a booking through the site.",
            },
            {
              q: "Can I get a remote tune if there\u2019s no shop near me?",
              a: "Absolutely. Many of our tuners specialize in remote calibration for HP Tuners, EFILive, COBB, MoTeC, and other platforms. You send datalogs, they send revised files \u2014 no road trip required.",
            },
            {
              q: "What does it cost?",
              a: "Pricing is set by each tuner. Most charge by tuning type (dyno, street, track, remote) and post starting prices on their profile. Booking through TunersAmerica is free for drivers; tuners pay an annual subscription to list.",
            },
            {
              q: "What if my build is unusual?",
              a: "Use the filters on the tuner directory to narrow by make, engine, forced induction, fuel, and transmission. If you don\u2019t see a perfect match, message a tuner directly \u2014 most will discuss custom builds before you book.",
            },
          ].map((f) => (
            <Card key={f.q} className="p-6">
              <h3 className="font-display text-lg font-bold">{f.q}</h3>
              <p className="mt-2 text-muted-foreground">{f.a}</p>
            </Card>
          ))}
        </div>
        {/* FAQPage JSON-LD so Google can show these as rich snippets on the SERP. */}
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: [
                { "@type": "Question", name: "How do I find a tuner near me?", acceptedAnswer: { "@type": "Answer", text: "Enter your ZIP code on the Find a Tuner page and choose a search radius. We\u2019ll show every verified tuner within range, sorted by distance." } },
                { "@type": "Question", name: "What kinds of tuning can I book?", acceptedAnswer: { "@type": "Answer", text: "Dyno, street, track, and remote ECU tuning across nearly every modern platform." } },
                { "@type": "Question", name: "Are the tuners verified?", acceptedAnswer: { "@type": "Answer", text: "Yes. Every tuner is vetted before their listing is published, and reviews come from real customers who completed a booking." } },
                { "@type": "Question", name: "Can I get a remote tune if there is no shop near me?", acceptedAnswer: { "@type": "Answer", text: "Many tuners specialize in remote calibration via HP Tuners, EFILive, COBB, MoTeC, and similar platforms." } },
                { "@type": "Question", name: "What does it cost?", acceptedAnswer: { "@type": "Answer", text: "Pricing is set by each tuner. Booking is free for drivers; tuners pay an annual subscription to list." } },
              ],
            }),
          }}
        />
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
