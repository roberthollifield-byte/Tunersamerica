import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Layout, Section } from "@/components/Layout";
import { LogoMark } from "@/components/Logo";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Mail, MailCheck, Loader2, Info, ArrowRight } from "lucide-react";

const schema = z.object({
  name: z.string().optional(),
  email: z.string().email("Enter a valid email"),
});
type FormValues = z.infer<typeof schema>;

function getParam(key: string): string | null {
  return new URLSearchParams(window.location.hash.split("?")[1] || "").get(key);
}

export default function SignIn() {
  const [, navigate] = useLocation();
  const { loginWithToken } = useAuth();
  const [role, setRole] = useState<"customer" | "tuner">(getParam("role") === "tuner" ? "tuner" : "customer");
  const [sent, setSent] = useState<{ link?: string; token?: string; emailStubbed: boolean; email: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const redirect = getParam("redirect");

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: "", email: "" } });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/magic-link", { ...values, role });
      const data = await res.json();
      setSent({
        link: data.link,
        token: data.token,
        emailStubbed: !!data.emailStubbed,
        email: values.email,
      });
    } finally {
      setLoading(false);
    }
  }

  async function continueWithLink() {
    if (!sent || !sent.token) return;
    const user = await loginWithToken(sent.token);
    if (user) {
      if (redirect) navigate(redirect);
      else navigate(user.role === "tuner" ? "/dashboard/tuner" : "/dashboard/customer");
    }
  }

  // One-click demo sign-in: request a magic link, log in, and route to the dashboard.
  // Only available in demo mode (when the API returns the token instead of emailing).
  async function signInAsSeed(email: string, seedRole: "customer" | "tuner") {
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/magic-link", { email, role: seedRole });
      const data = await res.json();
      if (!data.emailStubbed || !data.token) return; // disabled in production
      const user = await loginWithToken(data.token);
      if (user) navigate(user.role === "tuner" ? "/dashboard/tuner" : "/dashboard/customer");
    } finally {
      setLoading(false);
    }
  }

  const seeds = [
    { label: "Seeded tuner — Apex Calibrations (active subscription)", email: "tuner@apexcal.com", role: "tuner" as const },
    { label: "Seeded customer — Sam Okafor (has a vehicle + booking)", email: "driver@tunersamerica.com", role: "customer" as const },
  ];

  // Hide the demo accounts panel in production (when sending real email).
  // We learn that asynchronously from the sign-in response, so this just hides it
  // once any send returns emailStubbed:false.
  const isProd = sent?.emailStubbed === false;

  return (
    <Layout>
      <Section className="flex justify-center py-16">
        <Card className="w-full max-w-md p-8">
          <div className="flex flex-col items-center text-center">
            <LogoMark className="h-12 w-12" />
            <h1 className="mt-4 font-display text-2xl font-bold">Sign in to TunersAmerica</h1>
            <p className="mt-1 text-sm text-muted-foreground">We'll email you a magic link — no password.</p>
          </div>

          <Tabs value={role} onValueChange={(v) => setRole(v as any)} className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="customer" data-testid="tab-role-customer">I'm a car owner</TabsTrigger>
              <TabsTrigger value="tuner" data-testid="tab-role-tuner">I'm a tuner</TabsTrigger>
            </TabsList>
          </Tabs>

          {!sent ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name (new accounts)</FormLabel>
                    <FormControl><Input placeholder="Your name" {...field} data-testid="input-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input type="email" placeholder="you@email.com" {...field} data-testid="input-email" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={loading} data-testid="button-send-link">
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                  Send magic link
                </Button>
              </form>
            </Form>
          ) : sent.emailStubbed ? (
            <div className="mt-6 space-y-4">
              <Alert>
                <MailCheck className="h-4 w-4" />
                <AlertTitle>Magic link ready (demo)</AlertTitle>
                <AlertDescription>
                  Email isn't configured in this environment. Click below to sign in.
                </AlertDescription>
              </Alert>
              <div className="rounded-md border border-border bg-muted/40 p-3 font-mono text-xs break-all text-muted-foreground" data-testid="text-magic-link">
                {sent.link}
              </div>
              <Button className="w-full" onClick={continueWithLink} data-testid="button-continue-link">
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setSent(null)} data-testid="button-use-different-email">Use a different email</Button>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <Alert>
                <MailCheck className="h-4 w-4" />
                <AlertTitle>Check your inbox</AlertTitle>
                <AlertDescription>
                  We just sent a sign-in link to <span className="font-medium text-foreground">{sent.email}</span>. The link expires in 30 minutes.
                </AlertDescription>
              </Alert>
              <Button variant="ghost" className="w-full" onClick={() => setSent(null)} data-testid="button-use-different-email">Use a different email</Button>
            </div>
          )}

          {!isProd && (
            <div className="mt-7 border-t border-border pt-5">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Info className="h-3.5 w-3.5" /> Demo accounts (one click — dev only)
              </div>
              <div className="space-y-2">
                {seeds.map((s) => (
                  <button
                    key={s.email}
                    className="w-full rounded-md border border-border p-2.5 text-left text-xs hover-elevate"
                    data-testid={`button-seed-${s.email}`}
                    disabled={loading}
                    onClick={() => signInAsSeed(s.email, s.role)}
                  >
                    <div className="font-medium text-foreground">{s.label}</div>
                    <div className="font-mono text-muted-foreground">{s.email}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>
      </Section>
    </Layout>
  );
}
