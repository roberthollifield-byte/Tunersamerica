import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { Layout, Section } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/Logo";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

function getTokenFromHash(): string | null {
  return new URLSearchParams(window.location.hash.split("?")[1] || "").get("token");
}

type Status = "verifying" | "success" | "error";

export default function VerifyEmail() {
  const { loginWithToken } = useAuth();
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<Status>("verifying");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const token = getTokenFromHash();
    if (!token) {
      setStatus("error");
      setMessage("No verification token was provided.");
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) {
          setStatus("error");
          setMessage(data?.message || "That verification link is invalid or has already been used.");
          return;
        }
        if (data.sessionToken) {
          const user = await loginWithToken(data.sessionToken);
          setStatus("success");
          // Brief pause so the user sees the success state before we redirect.
          setTimeout(() => {
            if (user) {
              navigate(user.role === "tuner" ? "/dashboard/tuner" : "/dashboard/customer");
            } else {
              navigate("/signin");
            }
          }, 900);
        } else {
          setStatus("success");
          setTimeout(() => navigate("/signin"), 900);
        }
      } catch {
        setStatus("error");
        setMessage("Something went wrong verifying your email. Please try again.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Layout>
      <Section className="flex justify-center py-16">
        <Card className="w-full max-w-md p-8">
          <div className="flex flex-col items-center text-center">
            <LogoMark className="h-12 w-12" />
            {status === "verifying" && (
              <>
                <h1 className="mt-4 font-display text-2xl font-bold">Verifying your email…</h1>
                <Loader2 className="mt-6 h-8 w-8 animate-spin text-primary" />
              </>
            )}
            {status === "success" && (
              <>
                <CheckCircle2 className="mt-4 h-10 w-10 text-primary" />
                <h1 className="mt-4 font-display text-2xl font-bold">Email verified</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Signing you in…
                </p>
              </>
            )}
            {status === "error" && (
              <>
                <XCircle className="mt-4 h-10 w-10 text-destructive" />
                <h1 className="mt-4 font-display text-2xl font-bold">Verification failed</h1>
                <p className="mt-2 text-sm text-muted-foreground" data-testid="text-verify-error">{message}</p>
                <Link href="/signin">
                  <Button className="mt-6 w-full" data-testid="button-back-to-signin">
                    Back to sign in
                  </Button>
                </Link>
              </>
            )}
          </div>
        </Card>
      </Section>
    </Layout>
  );
}
