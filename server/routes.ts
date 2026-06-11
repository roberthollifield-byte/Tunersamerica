import type { Express, Request, Response } from "express";
import type { Server } from "node:http";
import { storage } from "./storage";
import {
  createBookingSchema,
  insertVehicleSchema,
  insertServiceSchema,
  insertReviewSchema,
} from "@shared/schema";
import { z } from "zod";

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function publicUser(u: any) {
  if (!u) return null;
  // expose token so the demo magic-link / context works in the sandbox iframe
  return u;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  /* ---------- Auth (magic link, stubbed) ---------- */

  // "Send" a magic link. In production this emails via Resend; here we return the link.
  app.post("/api/auth/magic-link", async (req: Request, res: Response) => {
    const schema = z.object({
      email: z.string().email(),
      name: z.string().optional(),
      role: z.enum(["tuner", "customer"]).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid email" });

    let user = await storage.getUserByEmail(parsed.data.email);
    if (!user) {
      user = await storage.createUser({
        email: parsed.data.email,
        name: parsed.data.name || parsed.data.email.split("@")[0],
        role: parsed.data.role || "customer",
        stripeCustomerId: null,
        stripeAccountId: null,
        hostSubscriptionStatus: parsed.data.role === "tuner" ? "inactive" : null,
      } as any);
    }
    // STUB: production would email this link via Resend.
    const link = `#/auth/callback?token=${user.token}`;
    console.log(`[magic-link] (stubbed email) for ${user.email}: ${link}`);
    res.json({ ok: true, link, token: user.token, emailStubbed: true });
  });

  // Resolve a session from a token (used by React auth context).
  app.get("/api/me", async (req: Request, res: Response) => {
    const token = req.query.token as string | undefined;
    if (!token) return res.status(401).json({ message: "No token" });
    const user = await storage.getUserByToken(token);
    if (!user) return res.status(401).json({ message: "Invalid token" });
    res.json(publicUser(user));
  });

  /* ---------- Listings ---------- */

  app.get("/api/listings", async (_req: Request, res: Response) => {
    // Only subscription-active (isVisible) listings are returned publicly.
    res.json(await storage.getVisibleListingsWithDetails());
  });

  app.get("/api/listings/:id", async (req: Request, res: Response) => {
    const listing = await storage.getListingWithDetails(Number(req.params.id));
    if (!listing) return res.status(404).json({ message: "Listing not found" });
    res.json(listing);
  });

  app.get("/api/me/listing", async (req: Request, res: Response) => {
    const token = req.query.token as string | undefined;
    const user = token ? await storage.getUserByToken(token) : undefined;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const listing = await storage.getListingByUserId(user.id);
    if (!listing) return res.json(null);
    res.json(await storage.getListingWithDetails(listing.id));
  });

  // Also expose /api/tuners as an alias for /api/listings (for Railway health check)
  app.get("/api/tuners", async (_req: Request, res: Response) => {
    res.json(await storage.getVisibleListingsWithDetails());
  });

  app.patch("/api/listings/:id", async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const patch: any = {};
    const b = req.body || {};
    if (typeof b.shopName === "string") patch.shopName = b.shopName;
    if (typeof b.location === "string") patch.location = b.location;
    if (typeof b.bio === "string") patch.bio = b.bio;
    if (typeof b.dynoAvailable === "boolean") patch.dynoAvailable = b.dynoAvailable;
    if (typeof b.remoteAvailable === "boolean") patch.remoteAvailable = b.remoteAvailable;
    if (Array.isArray(b.supportedMakes)) patch.supportedMakes = b.supportedMakes;
    if (typeof b.startingPrice === "number") patch.startingPrice = b.startingPrice;
    const updated = await storage.updateListing(id, patch);
    if (!updated) return res.status(404).json({ message: "Listing not found" });
    res.json(updated);
  });

  /* ---------- Services ---------- */

  app.post("/api/services", async (req: Request, res: Response) => {
    const parsed = insertServiceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid service" });
    res.json(await storage.createService(parsed.data));
  });

  app.delete("/api/services/:id", async (req: Request, res: Response) => {
    await storage.deleteService(Number(req.params.id));
    res.json({ ok: true });
  });

  /* ---------- Vehicles ---------- */

  app.get("/api/vehicles", async (req: Request, res: Response) => {
    const userId = Number(req.query.userId);
    if (!userId) return res.status(400).json({ message: "userId required" });
    res.json(await storage.getVehiclesByUser(userId));
  });

  app.post("/api/vehicles", async (req: Request, res: Response) => {
    const parsed = insertVehicleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid vehicle" });
    res.json(await storage.createVehicle(parsed.data));
  });

  /* ---------- Bookings ---------- */

  app.post("/api/bookings", async (req: Request, res: Response) => {
    const parsed = createBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message || "Invalid booking";
      return res.status(400).json({ message: msg });
    }
    const data = parsed.data;
    const listing = await storage.getListing(data.listingId);
    if (!listing) return res.status(404).json({ message: "Listing not found" });

    // Server-side fee math: serviceFee = round(subtotal * 0.10)
    const serviceFee = Math.round(data.subtotal * 0.1);
    const total = data.subtotal + serviceFee;

    const booking = await storage.createBooking({
      customerId: data.customerId,
      tunerId: listing.userId,
      listingId: data.listingId,
      serviceId: data.serviceId ?? null,
      vehicleId: data.vehicleId,
      status: "requested",
      subtotal: data.subtotal,
      serviceFee,
      total,
      insuranceAcknowledged: true,
      paid: false,
      notes: data.notes || "",
      createdAt: Date.now(),
    });
    res.json(booking);
  });

  app.get("/api/bookings", async (req: Request, res: Response) => {
    const customerId = req.query.customerId ? Number(req.query.customerId) : undefined;
    const tunerId = req.query.tunerId ? Number(req.query.tunerId) : undefined;
    const list = customerId
      ? await storage.getBookingsByCustomer(customerId)
      : tunerId
      ? await storage.getBookingsByTuner(tunerId)
      : [];
    // enrich with listing + vehicle + service detail for display
    const enriched = await Promise.all(
      list.map(async (bk) => {
        const listing = await storage.getListing(bk.listingId);
        const svcList = listing ? await storage.getServicesByListing(listing.id) : [];
        const service = svcList.find((s) => s.id === bk.serviceId);
        const vehicleList = await storage.getVehiclesByUser(bk.customerId);
        const vehicle = vehicleList.find((v) => v.id === bk.vehicleId);
        const customer = await storage.getUser(bk.customerId);
        return {
          ...bk,
          shopName: listing?.shopName,
          serviceName: service?.name,
          vehicleLabel: vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : undefined,
          customerName: customer?.name,
        };
      })
    );
    res.json(enriched);
  });

  app.patch("/api/bookings/:id", async (req: Request, res: Response) => {
    const status = req.body?.status as string | undefined;
    const updated = await storage.updateBooking(Number(req.params.id), status ? { status } : {});
    if (!updated) return res.status(404).json({ message: "Booking not found" });
    res.json(updated);
  });

  // STUB: mark booking paid (production = Stripe Checkout / PaymentIntent)
  app.post("/api/bookings/:id/checkout", async (req: Request, res: Response) => {
    const updated = await storage.updateBooking(Number(req.params.id), {
      paid: true,
      status: "accepted",
    });
    if (!updated) return res.status(404).json({ message: "Booking not found" });
    res.json({ ok: true, demoMode: true, booking: updated });
  });

  /* ---------- Reviews ---------- */

  app.post("/api/reviews", async (req: Request, res: Response) => {
    const parsed = insertReviewSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid review" });
    res.json(await storage.createReview(parsed.data));
  });

  /* ---------- Stripe stubs (demo mode) ---------- */

  // Host subscription: $99/year
  app.post("/api/stripe/subscribe", async (req: Request, res: Response) => {
    const token = req.body?.token as string | undefined;
    const user = token ? await storage.getUserByToken(token) : undefined;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const periodEnd = Date.now() + YEAR_MS;
    await storage.upsertSubscription(user.id, "active", periodEnd);
    const updated = await storage.setHostSubscription(user.id, "active");
    res.json({ ok: true, demoMode: true, currentPeriodEnd: periodEnd, user: updated });
  });

  // Stripe Connect onboarding
  app.post("/api/stripe/connect/onboard", async (req: Request, res: Response) => {
    const token = req.body?.token as string | undefined;
    const user = token ? await storage.getUserByToken(token) : undefined;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const updated = await storage.setStripeAccount(user.id, `acct_mock_${user.id}`);
    res.json({ ok: true, demoMode: true, stripeAccountId: updated?.stripeAccountId, user: updated });
  });

  return httpServer;
}
