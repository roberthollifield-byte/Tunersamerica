import { Layout, Section, Eyebrow } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

function Page({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <Layout>
      <Section className="pb-16 pt-12">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold md:text-5xl">{title}</h1>
        <div className="prose-tl mt-6 max-w-3xl space-y-4 text-muted-foreground">{children}</div>
      </Section>
    </Layout>
  );
}

export function About() {
  return (
    <Page eyebrow="About" title="Connecting cars with the right tuners.">
      <p>TunersAmerica is a two-sided marketplace built for the performance world. On one side are car owners — daily-driver enthusiasts, weekend racers, and serious builders. On the other are automotive tuners and tuning shops with deep platform expertise.</p>
      <p>Our goal is simple: make it easy to find a tuner who actually understands your platform, your modifications, and your goals — whether that work happens remotely through datalogs and file revisions, or in person on a dyno.</p>
      <p>This is a demonstration build. Payments (Stripe Connect) and transactional email (Resend) are stubbed for the preview environment.</p>
    </Page>
  );
}

export function Privacy() {
  return (
    <Page eyebrow="Privacy" title="Privacy Policy">
      <p><strong>Placeholder policy.</strong> This page is a placeholder for the TunersAmerica demo and does not constitute a binding privacy policy.</p>
      <p>In production, TunersAmerica would describe what data it collects (account details, vehicle information, booking history), how it is used, and how it is protected. We would only collect what is necessary to operate the marketplace.</p>
      <p>We would never sell your personal data. Payment data would be handled by Stripe and never stored on our servers.</p>
    </Page>
  );
}

export function Terms() {
  return (
    <Page eyebrow="Terms" title="Terms of Service">
      <p><strong>Placeholder terms.</strong> This page is a placeholder for the TunersAmerica demo.</p>
      <p>In production these terms would cover marketplace conduct, the $99/year host subscription, the $10 / 30-day buyer access pass, booking and cancellation policies, and the insurance acknowledgment required before any booking is confirmed.</p>
      <p>Tuning modifies vehicle behavior. Drivers acknowledge associated risks and insurance considerations before each booking.</p>
    </Page>
  );
}

export function Contact() {
  const { toast } = useToast();
  return (
    <Layout>
      <Section className="pb-16 pt-12">
        <Eyebrow>Contact</Eyebrow>
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold md:text-5xl">Get in touch.</h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">Questions about listing your shop or booking a service? Send us a note. (Demo form — submissions are not stored.)</p>
        <Card className="mt-8 max-w-xl p-6">
          <form
            className="space-y-4"
            onSubmit={(e) => { e.preventDefault(); toast({ title: "Message sent (demo)", description: "Thanks — we'll be in touch." }); }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label htmlFor="c-name">Name</Label><Input id="c-name" className="mt-1.5" required data-testid="input-contact-name" /></div>
              <div><Label htmlFor="c-email">Email</Label><Input id="c-email" type="email" className="mt-1.5" required data-testid="input-contact-email" /></div>
            </div>
            <div><Label htmlFor="c-msg">Message</Label><Textarea id="c-msg" className="mt-1.5 min-h-32" required data-testid="input-contact-message" /></div>
            <Button type="submit" data-testid="button-contact-submit">Send message</Button>
          </form>
        </Card>
      </Section>
    </Layout>
  );
}
