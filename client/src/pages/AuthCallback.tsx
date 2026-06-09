import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Layout, Section } from "@/components/Layout";
import { Loader2 } from "lucide-react";

export default function AuthCallback() {
  const { loginWithToken } = useAuth();
  const [, navigate] = useLocation();
  const [error, setError] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.split("?")[1] || "").get("token");
    if (!token) { setError(true); return; }
    loginWithToken(token).then((u) => {
      if (u) navigate(u.role === "tuner" ? "/dashboard/tuner" : "/dashboard/customer");
      else setError(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Layout>
      <Section className="flex flex-col items-center py-24 text-center">
        {error ? (
          <div className="text-muted-foreground">That magic link is invalid or expired. Please sign in again.</div>
        ) : (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="mt-4 text-muted-foreground">Signing you in…</div>
          </>
        )}
      </Section>
    </Layout>
  );
}
