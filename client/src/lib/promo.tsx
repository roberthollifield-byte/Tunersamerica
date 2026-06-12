import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./auth";
import { apiRequest } from "./queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Ticket } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Props = {
  /** "buyer" = applies to $10 pass; "tuner" = applies to $99/yr sub */
  audience: "buyer" | "tuner";
  className?: string;
};

/**
 * Inline promo-code input. Posts to /api/promo/redeem.
 *  - Buyer success: pass is granted server-side; we invalidate pass queries.
 *  - Tuner success: server returns a Stripe Checkout URL with a free trial; we redirect.
 *  - Demo-mode tuner: server marks active immediately; we toast and refresh.
 */
export function PromoRedeemBox({ audience, className }: Props) {
  const { token } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [code, setCode] = useState("");

  const redeem = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/promo/redeem", { token, code });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "That code didn't work");
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.kind === "tuner_trial_checkout" && data?.url) {
        window.location.href = data.url;
        return;
      }
      if (data?.kind === "buyer_pass_granted") {
        qc.invalidateQueries({ queryKey: ["/api/buyer/pass"] });
        qc.invalidateQueries({ queryKey: ["/api/listings"] });
        qc.invalidateQueries({ queryKey: ["/api/me"] });
        toast({
          title: "Pass unlocked",
          description: "Your promo code worked — directory is open.",
        });
        return;
      }
      if (data?.kind === "tuner_trial_granted") {
        qc.invalidateQueries({ queryKey: ["/api/me"] });
        toast({
          title: "Trial started",
          description: "Your free trial is active. We'll bill $99/yr when it ends.",
        });
        return;
      }
      toast({ title: "Code applied", description: "You're all set." });
    },
    onError: (e: any) =>
      toast({ title: "Couldn't use that code", description: e.message, variant: "destructive" }),
  });

  const isPending = redeem.isPending;
  const placeholder =
    audience === "buyer"
      ? "Promo code (e.g. FOUNDERS)"
      : "Promo code for free trial";
  const buttonLabel =
    audience === "buyer" ? "Apply code" : "Apply code & start trial";

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Ticket className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={placeholder}
            className="pl-8 uppercase"
            disabled={isPending}
            data-testid={`input-promo-${audience}`}
          />
        </div>
        <Button
          variant="outline"
          onClick={() => code.trim() && redeem.mutate()}
          disabled={isPending || !code.trim()}
          data-testid={`button-promo-${audience}`}
        >
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {buttonLabel}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        First-time {audience === "buyer" ? "buyers" : "tuners"} only · one code per account
      </p>
    </div>
  );
}
