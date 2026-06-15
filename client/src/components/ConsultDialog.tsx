import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Phone, Loader2 } from "lucide-react";

interface ConsultDialogProps {
  tunerId: number;
  tunerName: string;
  shopName?: string;
}

export function ConsultDialog({ tunerId, tunerName, shopName }: ConsultDialogProps) {
  const { user, token } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [driverPhone, setDriverPhone] = useState("");
  const [topic, setTopic] = useState("");
  const [preferredTime, setPreferredTime] = useState("");

  const submit = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/consultations", {
        token,
        driverId: user!.id,
        tunerId,
        driverPhone: driverPhone.trim(),
        topic: topic.trim(),
        preferredTime: preferredTime.trim(),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Consultation requested",
        description: `${tunerName} will be notified and will reach out with their number once they accept.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/me/consultations"] });
      setOpen(false);
      setDriverPhone("");
      setTopic("");
      setPreferredTime("");
    },
    onError: (e: any) => {
      toast({ title: "Could not book consult", description: e.message, variant: "destructive" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      navigate("/signin");
      return;
    }
    if (user.role !== "customer") {
      toast({
        title: "Drivers only",
        description: "Phone consultations are available to drivers.",
        variant: "destructive",
      });
      return;
    }
    if (driverPhone.trim().length < 7 || topic.trim().length < 3 || preferredTime.trim().length < 2) {
      toast({
        title: "Please complete the form",
        description: "Phone, topic, and preferred time are all required.",
        variant: "destructive",
      });
      return;
    }
    submit.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="mt-2 w-full"
          data-testid={`button-consult-${tunerId}`}
        >
          <Phone className="mr-2 h-4 w-4" />
          $125 · 1-hour phone consult
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Book a phone consult with {shopName || tunerName}</DialogTitle>
          <DialogDescription>
            One-hour phone consultation. $125 paid directly to the tuner — no platform fee. Once they accept, they'll share their phone number and a scheduled time.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="consult-phone">Your phone number</Label>
            <Input
              id="consult-phone"
              type="tel"
              placeholder="(555) 123-4567"
              value={driverPhone}
              onChange={(e) => setDriverPhone(e.target.value)}
              data-testid="input-consult-phone"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="consult-topic">What do you want to talk about?</Label>
            <Textarea
              id="consult-topic"
              placeholder="e.g. 2018 Mustang GT, Whipple supercharger install, need help dialing in fueling."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              data-testid="input-consult-topic"
              rows={3}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="consult-time">Preferred day & time</Label>
            <Input
              id="consult-time"
              placeholder="e.g. Weekday evenings after 6pm EST"
              value={preferredTime}
              onChange={(e) => setPreferredTime(e.target.value)}
              data-testid="input-consult-time"
              required
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              data-testid="button-consult-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submit.isPending}
              data-testid="button-consult-submit"
            >
              {submit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Request consult
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
