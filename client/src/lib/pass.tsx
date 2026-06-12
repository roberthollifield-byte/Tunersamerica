import { useEffect, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./auth";
import { apiRequest } from "./queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Check, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PromoRedeemBox } from "./promo";

export type PassStatus = {
  active: boolean;
  passExpiresAt: number | null;
  role: string;
};

/** Read the current buyer pass status for the signed-in user. */
export function usePassStatus() {
  const { user, token } = useAuth();
  return useQuery<PassStatus>({
    queryKey: ["/api/buyer/pass", token],
    enabled: !!user && !!token,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/buyer/pass?token=${encodeURIComponent(token!)}`);
      return res.json();
    },
  });
}

/** Format ms-epoch into a relative "in 27 days" string. */
export function formatPassRemaining(expiresAt: number | null): string {
  if (!expiresAt) return "No active pass";
  const ms = expiresAt - Date.now();
  if (ms <= 0) return "Expired";
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days >= 1) return `${days} day${days === 1 ? "" : "s"} left`;
  const hours = Math.floor(ms / (60 * 60 * 1000));
  return `${Math.max(1, hours)} hour${hours === 1 ? "" : "s"} left`;
}

/** Paywall card — shown when a buyer has no active pass. */
export function PassPaywall({
  headline = "Unlock the directory — $10 for 30 days",
  sub = "Find your tuner. Tuners keep 100%.",
}: {
  headline?: string;
  sub?: string;
}) {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setTick] = useState(0); // force re-render after purchase

  const buy = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/buyer/pass/checkout", { token });
      return res.json();
    },
    onSuccess: (data: any) => {
      // Live Stripe path — redirect to Stripe Checkout.
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      // Demo path — instant grant.
      qc.invalidateQueries({ queryKey: ["/api/buyer/pass"] });
      qc.invalidateQueries({ queryKey: ["/api/listings"] });
      setTick((t) => t + 1);
      toast({
        title: "Pass active",
        description: "You have 30 days of access. Browse the full directory below.",
      });
    },
    onError: (e: any) =>
      toast({ title: "Couldn't purchase pass", description: e.message, variant: "destructive" }),
  });

  if (!user) {
    return (
      <Card className="mx-auto max-w-xl p-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/15 text-primary">
          <Lock className="h-5 w-5" />
        </div>
        <h2 className="mt-5 font-display text-2xl font-bold">{headline}</h2>
        <p className="mt-2 text-muted-foreground">{sub}</p>
        <p className="mt-4 text-sm text-muted-foreground">
          Sign in or create a free account to purchase your pass.
        </p>
        <Button
          className="mt-5"
          size="lg"
          onClick={() => (window.location.hash = "#/signin?redirect=/tuners")}
          data-testid="button-paywall-signin"
        >
          Sign in to continue
        </Button>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-xl p-8 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/15 text-primary">
        <Lock className="h-5 w-5" />
      </div>
      <h2 className="mt-5 font-display text-2xl font-bold">{headline}</h2>
      <p className="mt-2 text-muted-foreground">{sub}</p>
      <ul className="mx-auto mt-5 max-w-sm space-y-2 text-left text-sm text-muted-foreground">
        <li className="flex items-start gap-2">
          <Check className="mt-0.5 h-4 w-4 flex-none text-primary" />
          Browse every verified tuner for 30 days.
        </li>
        <li className="flex items-start gap-2">
          <Check className="mt-0.5 h-4 w-4 flex-none text-primary" />
          Send unlimited booking requests.
        </li>
        <li className="flex items-start gap-2">
          <Check className="mt-0.5 h-4 w-4 flex-none text-primary" />
          No platform fee — tuners keep 100% of their service price.
        </li>
      </ul>
      <Button
        className="mt-6 w-full sm:w-auto"
        size="lg"
        onClick={() => buy.mutate()}
        disabled={buy.isPending}
        data-testid="button-buy-pass"
      >
        {buy.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : null}
        Buy 30-day pass — $10
      </Button>
      <p className="mt-3 text-xs text-muted-foreground">One-time charge. Pass expires after 30 days.</p>
      <div className="mt-6 border-t pt-6 text-left">
        <p className="mb-2 text-center text-sm font-medium">Have a promo code?</p>
        <PromoRedeemBox audience="buyer" />
      </div>
    </Card>
  );
}

/** Hook + helper: returns {pass, isLoading, hasAccess}. */
export function usePassGate() {
  const { user, loading: authLoading } = useAuth();
  const { data: pass, isLoading } = usePassStatus();
  // Tuners and admins bypass the buyer paywall.
  const bypass = user?.role === "tuner" || user?.role === "admin";
  const hasAccess = bypass || !!pass?.active;
  return {
    user,
    pass: pass ?? null,
    isLoading: authLoading || (!!user && isLoading),
    hasAccess,
  };
}

/** No-op effect to silence unused warnings if a page imports useCallback indirectly. */
export const _noop = useCallback;
useEffect; // keep imports
