import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { ListingWithDetails } from "@shared/schema";
import { Layout, Section } from "@/components/Layout";
import { StarRating } from "@/components/TunerCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { usePassGate, PassPaywall } from "@/lib/pass";
import { apiRequest } from "@/lib/queryClient";
import { money, parseMakes, listingImage, CAPABILITY_GROUPS, capabilityLabel, rating10 } from "@/lib/format";
import dyno from "@/assets/hero-dyno.png";
import ecu from "@/assets/hero-ecu.png";
import shop from "@/assets/tuner-shop.png";
import { MapPin, Gauge, Wifi, Star, Check, MessageSquare } from "lucide-react";
import { ConsultDialog } from "@/components/ConsultDialog";

export default function TunerProfile() {
  const [, params] = useRoute("/tuners/:id");
  const [, navigate] = useLocation();
  const { user, token } = useAuth();
  const { hasAccess, isLoading: gateLoading } = usePassGate();
  const id = Number(params?.id);
  const { data: listing, isLoading } = useQuery<ListingWithDetails>({
    queryKey: ["/api/listings", id, token],
    enabled: hasAccess && !!token && !!id,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/listings/${id}?token=${encodeURIComponent(token!)}`);
      return res.json();
    },
  });

  if (!hasAccess && !gateLoading) {
    return (
      <Layout>
        <Section className="py-16">
          <PassPaywall />
        </Section>
      </Layout>
    );
  }

  if (isLoading || gateLoading) {
    return (
      <Layout>
        <Section>
          <Skeleton className="h-72 w-full rounded-2xl" />
          <Skeleton className="mt-6 h-8 w-1/3" />
          <Skeleton className="mt-4 h-40 w-full" />
        </Section>
      </Layout>
    );
  }
  if (!listing) {
    return (
      <Layout><Section><h1 className="font-display text-2xl font-bold">Tuner not found</h1></Section></Layout>
    );
  }

  const makes = parseMakes(listing.supportedMakes);
  const gallery = [listingImage(listing.heroImage), dyno, ecu, shop];
  const capabilities = listing.capabilities ?? [];
  const tuningCaps = capabilities.filter((c) => c.groupName === "tuning_type");

  function startBooking() {
    if (!user) { navigate(`/signin?redirect=/book/${id}`); return; }
    navigate(`/book/${id}`);
  }

  return (
    <Layout>
      {/* Hero banner */}
      <div className="relative h-64 w-full overflow-hidden md:h-80">
        <img src={listingImage(listing.heroImage)} alt={listing.shopName} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      </div>

      <Section className="-mt-24 pt-0">
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          {/* Left: details */}
          <div>
            <Card className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="font-display text-3xl font-bold" data-testid="text-shop-name">{listing.shopName}</h1>
                  <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" /> {listing.location}
                  </div>
                </div>
                <StarRating value={listing.rating} count={listing.reviewCount} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {listing.dynoAvailable && <Badge className="gap-1"><Gauge className="h-3 w-3" /> Dyno on-site</Badge>}
                {listing.remoteAvailable && <Badge className="gap-1"><Wifi className="h-3 w-3" /> Remote tuning</Badge>}
                {makes.map((m) => <Badge key={m} variant="secondary">{m}</Badge>)}
              </div>
              <p className="mt-5 text-muted-foreground">{listing.bio}</p>
            </Card>

            {/* Gallery */}
            <h2 className="mt-8 font-display text-xl font-bold">Gallery</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              {gallery.map((g, i) => (
                <div key={i} className="overflow-hidden rounded-lg border border-card-border">
                  <img src={g} alt={`${listing.shopName} ${i + 1}`} className="aspect-square w-full object-cover" data-testid={`img-gallery-${i}`} />
                </div>
              ))}
            </div>

            {/* Capabilities */}
            <h2 className="mt-8 font-display text-xl font-bold">Capabilities</h2>
            <div className="mt-3 space-y-4">
              {CAPABILITY_GROUPS.filter((g) => g.key !== "tuning_type").map((g) => {
                const groupCaps = capabilities.filter((c) => c.groupName === g.key);
                if (groupCaps.length === 0) return null;
                return (
                  <div key={g.key} data-testid={`profile-group-${g.key}`}>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">{g.label}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {groupCaps.map((c) => (
                        <Badge key={c.id} variant="secondary" data-testid={`badge-cap-${c.groupName}-${c.value}`}>{c.value}</Badge>
                      ))}
                    </div>
                  </div>
                );
              })}
              {capabilities.length === 0 && (
                <p className="text-sm text-muted-foreground">No capabilities listed yet.</p>
              )}
            </div>

            {/* Tuning types + pricing */}
            {tuningCaps.length > 0 && (
              <>
                <h2 className="mt-8 font-display text-xl font-bold">Tuning types & pricing</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {tuningCaps.map((c) => (
                    <Card key={c.id} className="flex items-center justify-between gap-4 p-5" data-testid={`card-tuning-${c.value}`}>
                      <div>
                        <div className="font-semibold">{capabilityLabel("tuning_type", c.value)}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {c.price != null ? "Starting price" : "Available — contact for pricing"}
                        </div>
                      </div>
                      <div className="text-right">
                        {c.price != null && (
                          <div className="font-display text-lg font-bold">{money(c.price)}</div>
                        )}
                        <Button size="sm" className="mt-2" onClick={startBooking} data-testid={`button-book-tuning-${c.value}`}>Book</Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}

            {/* Reviews */}
            <h2 className="mt-8 font-display text-xl font-bold">Reviews</h2>
            {listing.reviews.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No reviews yet.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {listing.reviews.map((r) => (
                  <Card key={r.id} className="p-5" data-testid={`card-review-${r.id}`}>
                    <div className="flex items-center justify-between">
                      {r.authorUserId ? (
                        <button
                          className="font-semibold underline-offset-2 hover:underline"
                          onClick={() => navigate(`/drivers/${r.authorUserId}`)}
                          data-testid={`link-driver-${r.authorUserId}`}
                        >
                          {r.authorName}
                        </button>
                      ) : (
                        <div className="font-semibold">{r.authorName}</div>
                      )}
                      <div className="flex items-center gap-1 text-sm">
                        {Array.from({ length: r.rating }).map((_, i) => (
                          <Star key={i} className="h-3.5 w-3.5 fill-primary text-primary" />
                        ))}
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{r.comment}</p>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Right: booking sidebar */}
          <div>
            <Card className="p-6 lg:sticky lg:top-24">
              <div className="text-sm text-muted-foreground">Starting from</div>
              <div className="font-display text-3xl font-bold" data-testid="text-starting-price">{money(listing.startingPrice)}</div>
              <div className="mt-1 text-xs text-muted-foreground">No platform fee. Tuners keep 100%.</div>
              <Button className="mt-5 w-full" size="lg" onClick={startBooking} data-testid="button-book-service">Book service</Button>
              <Button variant="outline" className="mt-2 w-full" onClick={startBooking} data-testid="button-request-quote">
                <MessageSquare className="mr-2 h-4 w-4" /> Request a quote
              </Button>
              {(!user || user.role === "customer") && (
                <ConsultDialog
                  tunerId={listing.userId}
                  tunerName={listing.shopName}
                  shopName={listing.shopName}
                />
              )}
              <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                {[
                  listing.remoteAvailable ? "Remote tuning available" : "In-person work",
                  listing.dynoAvailable ? "In-house dyno" : "Partner dyno access",
                  `Rated ${rating10(listing.rating)} / 5`,
                  "Verified specialist profile",
                ].map((t) => (
                  <li key={t} className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> {t}</li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </Section>
    </Layout>
  );
}
