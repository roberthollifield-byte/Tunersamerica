import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { Layout, Section } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoMark } from "@/components/Logo";
import { useToast } from "@/hooks/use-toast";
import { Loader2, KeyRound, XCircle } from "lucide-react";

function getTokenFromHash(): string | null {
  return new URLSearchParams(window.location.hash.split("?")[1] || "").get("token");
}

export default function ResetPassword() {
  const { loginWithToken } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const token = getTokenFromHash();

  if (!token) {
    return (
      <Layout>
        <Section className="flex justify-center py-16">
          <Card className="w-full max-w-md p-8 text-center">
            <div className="flex flex-col items-center">
              <XCircle className="h-10 w-10 text-destructive" />
              <h1 className="mt-4 font-display text-2xl font-bold">Invalid reset link</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                This password reset link is missing or malformed.
              </p>
              <Link href="/signin">
                <Button className="mt-6 w-full">Back to sign in</Button>
              </Link>
            </div>
          </Card>
        </Section>
      </Layout>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Passwords don't match", description: "Re-enter to confirm.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        toast({
          title: "Couldn't reset password",
          description: data?.message || "That reset link is invalid or has expired.",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Password updated", description: "Signing you in…" });
      if (data.sessionToken) {
        const user = await loginWithToken(data.sessionToken);
        if (user) {
          navigate(user.role === "tuner" ? "/dashboard/tuner" : "/dashboard/customer");
          return;
        }
      }
      navigate("/signin");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <Section className="flex justify-center py-16">
        <Card className="w-full max-w-md p-8">
          <div className="flex flex-col items-center text-center">
            <LogoMark className="h-12 w-12" />
            <h1 className="mt-4 font-display text-2xl font-bold">Set a new password</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose a password you'll remember. Minimum 8 characters.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="input-new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                data-testid="input-confirm-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading} data-testid="button-reset-password">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              Update password
            </Button>
          </form>
        </Card>
      </Section>
    </Layout>
  );
}
