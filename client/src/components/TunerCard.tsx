import { Link } from "wouter";
import type { ListingWithDetails } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin, Gauge, Wifi } from "lucide-react";
import { money, rating10, parseMakes, listingImage } from "@/lib/format";

export function StarRating({ value, count }: { value: number; count?: number }) {
  return (
    <div className="flex items-center gap-1 text-sm" data-testid="text-rating">
      <Star className="h-4 w-4 fill-primary text-primary" />
      <span className="font-semibold">{rating10(value)}</span>
      {count != null && <span className="text-muted-foreground">({count})</span>}
    </div>
  );
}

export function TunerCard({ listing }: { listing: ListingWithDetails }) {
  const makes = parseMakes(listing.supportedMakes);
  return (
    <Link href={`/tuners/${listing.id}`} data-testid={`card-tuner-${listing.id}`}>
      <Card className="group h-full overflow-hidden border-card-border hover-elevate">
        <div className="relative h-40 overflow-hidden">
          <img
            src={listingImage(listing.heroImage)}
            alt={listing.shopName}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
          <div className="absolute left-3 top-3 flex gap-2">
            {listing.dynoAvailable && (
              <Badge className="gap-1 bg-background/80 text-foreground backdrop-blur">
                <Gauge className="h-3 w-3" /> Dyno
              </Badge>
            )}
            {listing.remoteAvailable && (
              <Badge className="gap-1 bg-background/80 text-foreground backdrop-blur">
                <Wifi className="h-3 w-3" /> Remote
              </Badge>
            )}
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-lg font-bold">{listing.shopName}</h3>
            <StarRating value={listing.rating} count={listing.reviewCount} />
          </div>
          <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> {listing.location}
          </div>
          <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{listing.bio}</p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {makes.slice(0, 4).map((m) => (
              <span key={m} className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs text-muted-foreground">
                {m}
              </span>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <div className="text-sm text-muted-foreground">
              from <span className="font-semibold text-foreground">{money(listing.startingPrice)}</span>
            </div>
            <span className="text-sm font-medium text-primary group-hover:underline">View profile →</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
