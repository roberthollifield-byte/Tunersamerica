import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

type Props = {
  bookingId: number;
  // What the *reviewer* is reviewing (label shown in the dialog).
  subject: string;
  // Optional: control trigger text.
  triggerLabel?: string;
  triggerSize?: "default" | "sm";
  triggerVariant?: "default" | "outline" | "ghost";
  // Optional: invalidate these query keys on success (callers can pass listing/driver/etc).
  invalidateKeys?: any[][];
  disabled?: boolean;
};

export function LeaveReviewDialog({
  bookingId,
  subject,
  triggerLabel = "Leave review",
  triggerSize = "sm",
  triggerVariant = "outline",
  invalidateKeys = [],
  disabled,
}: Props) {
  const { token } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const submit = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/reviews", {
        token,
        bookingId,
        rating,
        comment: comment.trim(),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Review posted", description: `Thanks for reviewing ${subject}.` });
      setOpen(false);
      setComment("");
      setRating(5);
      for (const k of invalidateKeys) {
        queryClient.invalidateQueries({ queryKey: k });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't post review",
        description: err?.message || "Try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size={triggerSize}
          variant={triggerVariant}
          disabled={disabled}
          data-testid={`button-open-review-${bookingId}`}
        >
          <Star className="mr-2 h-3.5 w-3.5" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review {subject}</DialogTitle>
          <DialogDescription>Public reviews help build trust in the community.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Rating</Label>
            <div className="mt-2 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  type="button"
                  key={n}
                  onClick={() => setRating(n)}
                  className="rounded p-1 hover:bg-muted"
                  data-testid={`button-rating-${n}`}
                  aria-label={`Rate ${n} star${n === 1 ? "" : "s"}`}
                >
                  <Star
                    className={`h-6 w-6 ${
                      n <= rating ? "fill-primary text-primary" : "text-muted-foreground"
                    }`}
                  />
                </button>
              ))}
              <span className="ml-2 text-sm text-muted-foreground">{rating} / 5</span>
            </div>
          </div>

          <div>
            <Label htmlFor={`review-comment-${bookingId}`} className="text-xs text-muted-foreground">
              Comment
            </Label>
            <Textarea
              id={`review-comment-${bookingId}`}
              className="mt-1.5"
              rows={4}
              maxLength={2000}
              placeholder="What went well? What stood out?"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              data-testid={`textarea-review-${bookingId}`}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={() => submit.mutate()}
            disabled={submit.isPending || comment.trim().length === 0}
            data-testid={`button-submit-review-${bookingId}`}
          >
            {submit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Post review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
