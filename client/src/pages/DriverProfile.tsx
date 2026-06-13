import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { DriverProfile as DriverProfileT } from "@shared/schema";
import { Layout, Section } from "@/components/Layout";
import { StarRating } from "@/components/TunerCard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { usePassGate, PassPaywall } from "@/lib/pass";
import { apiRequest } from "@/lib/queryClient";
import { Car, Star, MapPin } from "lucide-react";

export default function DriverProfile() {
  const [, params] = useRoute("/drivers/:id");
  const [, navigate] = useLocation();
  const { token } = useAuth();
  const { hasAccess, isLoading: gateLoading } = usePassGate();
  const id = Number(params?.id);

  const { data: profile, isLoading } = useQuery<DriverProfileT>({
    queryKey: ["/api/drivers", id, token],
    enabled: hasAccess && !!token && !!id,
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/drivers/${id}?token=${encodeURIComponent(token!)}`,
      );
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
        <Section className="py-12">
          <Skeleton className="h-12 w-1/3" />
          <Skeleton className="mt-4 h-40 w-full" />
          <Skeleton className="mt-4 h-40 w-full" />
        </Section>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <Section className="py-12">
          <h1 className="font-display text-2xl font-bold">Driver not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This driver profile is unavailable.
          </p>
        </Section>
      </Layout>
    );
  }

  return (
    <Layout>
      <Section className="py-12">
        {/* Header */}
        <Card className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Driver
              </div>
              <h1
                className="mt-1 font-display text-3xl font-bold"
                data-testid="text-driver-name"
              >
                {profile.name}
              </h1>
              <div className="mt-2 text-sm text-muted-foreground">
                {profile.reviewCount > 0
                  ? `${profile.reviewCount} review${profile.reviewCount === 1 ? "" : "s"} from tuners`
                  : "No tuner reviews yet"}
              </div>
            </div>
            {profile.reviewCount > 0 && (
              <StarRating value={profile.rating} count={profile.reviewCount} />
            )}
          </div>
        </Card>

        {/* Vehicles */}
        <h2 className="mt-8 font-display text-xl font-bold">Vehicles</h2>
        {profile.vehicles.length === 0 ? (
          <Card className="mt-3 p-8 text-center text-sm text-muted-foreground">
            No vehicles listed.
          </Card>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {profile.vehicles.map((v) => (
              <Card
                key={v.id}
                className="p-5"
                data-testid={`card-driver-vehicle-${v.id}`}
              >
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-primary" />
                  <span className="font-semibold">
                    {v.year} {v.make} {v.model}
                  </span>
                </div>
                {v.modifications && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {v.modifications}
                  </p>
                )}
                {v.fuelType && (
                  <Badge variant="secondary" className="mt-3">
                    {v.fuelType}
                  </Badge>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* Reviews from tuners */}
        <h2 className="mt-8 font-display text-xl font-bold">
          Reviews from tuners
        </h2>
        {profile.reviews.length === 0 ? (
          <Card className="mt-3 p-8 text-center text-sm text-muted-foreground">
            No reviews from tuners yet.
          </Card>
        ) : (
          <div className="mt-3 space-y-3">
            {profile.reviews.map((r) => (
              <Card
                key={r.id}
                className="p-5"
                data-testid={`card-driver-review-${r.id}`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{r.authorName}</div>
                  <div className="flex items-center gap-1 text-sm">
                    {Array.from({ length: r.rating }).map((_, i) => (
                      <Star
                        key={i}
                        className="h-3.5 w-3.5 fill-primary text-primary"
                      />
                    ))}
                  </div>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{r.comment}</p>
              </Card>
            ))}
          </div>
        )}
      </Section>
    </Layout>
  );
}
