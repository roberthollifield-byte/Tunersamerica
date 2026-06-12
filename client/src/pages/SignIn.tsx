import { useState } from "react";
import { useLocation } from "wouter";
import { Layout, Section } from "@/components/Layout";
import { LogoMark } from "@/components/Logo";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { LogIn, UserPlus, MailCheck, Loader2, KeyRound } from "lucide-react";

function getParam(key: string): string | null {
  return new URLSearchParams(window.location.hash.split("?")[1] || "").get(key);
}

type Mode = "signin" | "signup" | "forgot";

export default function SignIn() {
  const [, navigate] = useLocation();
  const { loginWithToken } = useAuth();
  const { toast } = useToast();

  const [mode, setMode] = useState<Mode>("signin");
  const [role, setRole] = useState<"customer" | "tuner">(getParam("role") === "tuner" ? "tuner" : "customer");
  const redirect = getParam("redirect");

  // Shared fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [postSignup, setPostSignup] = useState<{ email: string } | null>(null);
  const [forgotSent, setForgotSent] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);

  async function postJson(url: string, body: any) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    let data: any = null;
    try { data = await res.json(); } catch {}
    return { res, data };
  }

  async function landAfterAuth(sessionToken: string) {
    const user = await loginWithToken(sessionToken);
    if (!user) return;
    queryClient.invalidateQueries();
    if (redirect) navigate(redirect);
    else navigate(user.role === "tuner" ? "/dashboard/tuner" : "/dashboard/customer");
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setNeedsVerification(false);
    try {
      const { res, data } = await postJson("/api/auth/login", { email, password });
      if (!res.ok) {
        if (data?.needsVerification) setNeedsVerification(true);
        toast({ title: "Couldn't sign in", description: data?.message || "Try again.", variant: "destructive" });
        return;
      }
      if (data.sessionToken) await landAfterAuth(data.sessionToken);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { res, data } = await postJson("/api/auth/register", { email, password, name, role });
      if (!res.ok) {
        toast({ title: "Couldn't create account", description: data?.message || "Try again.", variant: "destructive" });
        return;
      }
      setPostSignup({ email });
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { res } = await postJson("/api/auth/forgot", { email });
      if (res.ok) setForgotSent(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    setLoading(true);
    try {
      const { res } = await postJson("/api/auth/resend-verification", { email });
      if (res.ok) toast({ title: "Verification email sent", description: `Check ${email}.` });
    } finally {
      setLoading(false);
    }
  }

  // Post-signup screen
  if (postSignup) {
    return (
      <Layout>
        <Section className="flex justify-center py-16">
          <Card className="w-full max-w-md p-8">
            <div className="flex flex-col items-center text-center">
              <LogoMark className="h-12 w-12" />
              <h1 className="mt-4 font-display text-2xl font-bold">Check your inbox</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We sent a verification link to <span className="font-medium text-foreground">{postSignup.email}</span>.
                Click it to activate your account, then sign in.
              </p>
            </div>
            <Alert className="mt-6">
              <MailCheck className="h-4 w-4" />
              <AlertTitle>One last step</AlertTitle>
              <AlertDescription>
                Verification links expire in 24 hours. Check your spam folder if you don't see it.
              </AlertDescription>
            </Alert>
            <Button
              variant="outline"
              className="mt-6 w-full"
              onClick={handleResendVerification}
              disabled={loading}
              data-testid="button-resend-verification"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Resend verification email
            </Button>
            <Button
              variant="ghost"
              className="mt-2 w-full"
              onClick={() => { setPostSignup(null); setMode("signin"); }}
            >
              Back to sign in
            </Button>
          </Card>
        </Section>
      </Layout>
    );
  }

  // Forgot password "sent" screen
  if (mode === "forgot" && forgotSent) {
    return (
      <Layout>
        <Section className="flex justify-center py-16">
          <Card className="w-full max-w-md p-8">
            <div className="flex flex-col items-center text-center">
              <LogoMark className="h-12 w-12" />
              <h1 className="mt-4 font-display text-2xl font-bold">Check your inbox</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                If an account exists for <span className="font-medium text-foreground">{email}</span>,
                we sent a password reset link. It expires in 30 minutes.
              </p>
            </div>
            <Button
              variant="ghost"
              className="mt-6 w-full"
              onClick={() => { setForgotSent(false); setMode("signin"); }}
            >
              Back to sign in
            </Button>
          </Card>
        </Section>
      </Layout>
    );
  }

  return (
    <Layout>
      <Section className="flex justify-center py-16">
        <Card className="w-full max-w-md p-8">
          <div className="flex flex-col items-center text-center">
            <LogoMark className="h-12 w-12" />
            <h1 className="mt-4 font-display text-2xl font-bold">
              {mode === "signin" ? "Sign in" : mode === "signup" ? "Create your account" : "Reset password"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "signin"
                ? "Welcome back to TunersAmerica."
                : mode === "signup"
                ? "Find the right tuner for your build."
                : "Enter your email and we'll send a reset link."}
            </p>
          </div>

          {mode !== "forgot" && (
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} className="mt-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin" data-testid="tab-signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup" data-testid="tab-signup">Create account</TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {mode === "signin" && (
            <form onSubmit={handleSignIn} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@email.com" value={email}
                  onChange={(e) => setEmail(e.target.value)} required data-testid="input-signin-email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password}
                  onChange={(e) => setPassword(e.target.value)} required data-testid="input-signin-password" />
              </div>
              {needsVerification && (
                <Alert>
                  <MailCheck className="h-4 w-4" />
                  <AlertTitle>Verify your email</AlertTitle>
                  <AlertDescription>
                    You need to verify your email before signing in.{" "}
                    <button type="button" onClick={handleResendVerification} className="underline">
                      Resend the verification email
                    </button>
                    .
                  </AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={loading} data-testid="button-signin">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                Sign in
              </Button>
              <button type="button" onClick={() => setMode("forgot")} className="block w-full text-center text-sm text-muted-foreground underline">
                Forgot password?
              </button>
            </form>
          )}

          {mode === "signup" && (
            <form onSubmit={handleSignUp} className="mt-6 space-y-4">
              <div>
                <Label className="mb-2 block">I'm signing up as</Label>
                <Tabs value={role} onValueChange={(v) => setRole(v as any)}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="customer" data-testid="tab-role-customer">A car owner</TabsTrigger>
                    <TabsTrigger value="tuner" data-testid="tab-role-tuner">A tuner</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signup-name">Name</Label>
                <Input id="signup-name" value={name} onChange={(e) => setName(e.target.value)} required data-testid="input-signup-name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signup-email">Email</Label>
                <Input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="input-signup-email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signup-password">Password</Label>
                <Input id="signup-password" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required data-testid="input-signup-password" />
                <p className="text-xs text-muted-foreground">Minimum 8 characters.</p>
              </div>
              <Button type="submit" className="w-full" disabled={loading} data-testid="button-signup">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                Create account
              </Button>
            </form>
          )}

          {mode === "forgot" && (
            <form onSubmit={handleForgot} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="forgot-email">Email</Label>
                <Input id="forgot-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="input-forgot-email" />
              </div>
              <Button type="submit" className="w-full" disabled={loading} data-testid="button-forgot">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                Send reset link
              </Button>
              <button type="button" onClick={() => setMode("signin")} className="block w-full text-center text-sm text-muted-foreground underline">
                Back to sign in
              </button>
            </form>
          )}
        </Card>
      </Section>
    </Layout>
  );
}
