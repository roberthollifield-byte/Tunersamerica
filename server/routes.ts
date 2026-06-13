import type { Express, Request, Response } from "express";
import type { Server } from "node:http";
import { storage } from "./storage";
import { sendMagicLinkEmail, sendVerificationEmail, sendPasswordResetEmail, emailEnabled } from "./email";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import {
  createBookingSchema,
  insertVehicleSchema,
  insertServiceSchema,
  insertReviewSchema,
  createReviewSchema,
  serviceCategories,
  capabilityGroups,
  TUNING_TYPES,
  ENGINES,
  ECUS,
  FUELS,
  INDUCTION,
  APPLICATIONS,
} from "@shared/schema";
import { z } from "zod";
import {
  getStripe,
  stripeEnabled,
  publishableKey,
  webhookSecret,
  siteUrl,
  BUYER_PASS_PRICE_ID,
  TUNER_SUB_PRICE_ID,
} from "./stripe";

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const PASS_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function publicUser(u: any) {
  if (!u) return null;
  // expose token so the demo magic-link / context works in the sandbox iframe
  return u;
}

function hasActivePass(user: any): boolean {
  if (!user) return false;
  if (user.role === "tuner" || user.role === "admin") return true;
  return typeof user.passExpiresAt === "number" && user.passExpiresAt > Date.now();
}

async function requireActivePass(req: Request, res: Response): Promise<any | null> {
  const token = (req.query.token as string | undefined) || (req.body?.token as string | undefined);
  if (!token) {
    res.status(402).json({ message: "Buyer pass required", code: "PASS_REQUIRED" });
    return null;
  }
  const user = await storage.getUserByToken(token);
  if (!user) {
    res.status(401).json({ message: "Invalid session" });
    return null;
  }
  if (!hasActivePass(user)) {
    res.status(402).json({
      message: "Buyer pass required",
      code: "PASS_REQUIRED",
      passExpiresAt: user.passExpiresAt ?? null,
    });
    return null;
  }
  return user;
}

function genToken() { return randomBytes(24).toString("hex"); }

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  /* ---------- Auth: email + password ---------- */

  // Create a new account. Sends a verification email; user must verify before they can sign in.
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(8, "Password must be at least 8 characters"),
      name: z.string().min(1),
      role: z.enum(["tuner", "customer"]),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid input" });
    }
    const existing = await storage.getUserByEmail(parsed.data.email);
    if (existing) {
      return res.status(409).json({ message: "An account with that email already exists. Try signing in." });
    }
    const hash = await bcrypt.hash(parsed.data.password, 10);
    const verifyToken = genToken();
    const user = await storage.createUser({
      email: parsed.data.email,
      name: parsed.data.name,
      role: parsed.data.role,
      stripeCustomerId: null,
      stripeAccountId: null,
      hostSubscriptionStatus: parsed.data.role === "tuner" ? "inactive" : null,
    } as any);
    await storage.setPasswordHash(user.id, hash);
    await storage.setEmailVerifyToken(user.id, verifyToken);
    const result = await sendVerificationEmail({ to: user.email, name: user.name, token: verifyToken });
    return res.json({
      ok: true,
      emailSent: emailEnabled && result.sent,
      // In dev / unconfigured email, expose the link so local testing still works.
      verifyLink: emailEnabled && result.sent ? undefined : result.link,
    });
  });

  // Verify an email using the token from the verification email.
  app.post("/api/auth/verify-email", async (req: Request, res: Response) => {
    const token = (req.body?.token as string | undefined)?.trim();
    if (!token) return res.status(400).json({ message: "Missing token" });
    const user = await storage.getUserByEmailVerifyToken(token);
    if (!user) return res.status(400).json({ message: "That verification link is invalid or has already been used." });
    const updated = await storage.markEmailVerified(user.id);
    // Return the session token so the SPA can sign them in immediately after verifying.
    return res.json({ ok: true, sessionToken: updated?.token, role: updated?.role });
  });

  // Resend the verification email.
  app.post("/api/auth/resend-verification", async (req: Request, res: Response) => {
    const email = (req.body?.email as string | undefined)?.toLowerCase().trim();
    if (!email) return res.status(400).json({ message: "Missing email" });
    const user = await storage.getUserByEmail(email);
    if (!user) return res.json({ ok: true }); // don't leak existence
    if (user.emailVerified) return res.json({ ok: true, alreadyVerified: true });
    const verifyToken = genToken();
    await storage.setEmailVerifyToken(user.id, verifyToken);
    await sendVerificationEmail({ to: user.email, name: user.name, token: verifyToken });
    return res.json({ ok: true });
  });

  // Sign in with email + password. Requires the email to be verified first.
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid email or password" });
    const user = await storage.getUserByEmail(parsed.data.email);
    if (!user || !user.passwordHash) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid email or password" });
    if (!user.emailVerified) {
      return res.status(403).json({ message: "Please verify your email before signing in.", needsVerification: true });
    }
    return res.json({ ok: true, sessionToken: user.token, role: user.role });
  });

  // Request a password reset email.
  app.post("/api/auth/forgot", async (req: Request, res: Response) => {
    const email = (req.body?.email as string | undefined)?.toLowerCase().trim();
    if (!email) return res.status(400).json({ message: "Missing email" });
    const user = await storage.getUserByEmail(email);
    // Always return 200 so we don't leak which emails are registered.
    if (!user) return res.json({ ok: true });
    const token = genToken();
    const expiresAt = Date.now() + 30 * 60 * 1000;
    await storage.setPasswordResetToken(user.id, token, expiresAt);
    await sendPasswordResetEmail({ to: user.email, name: user.name, token });
    return res.json({ ok: true });
  });

  // Reset password using the token from the reset email.
  app.post("/api/auth/reset", async (req: Request, res: Response) => {
    const schema = z.object({
      token: z.string().min(1),
      password: z.string().min(8, "Password must be at least 8 characters"),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid input" });
    const user = await storage.getUserByPasswordResetToken(parsed.data.token);
    if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < Date.now()) {
      return res.status(400).json({ message: "That reset link is invalid or has expired." });
    }
    const hash = await bcrypt.hash(parsed.data.password, 10);
    await storage.setPasswordHash(user.id, hash);
    await storage.setPasswordResetToken(user.id, null, null);
    // Reset implies email ownership, so mark verified too.
    if (!user.emailVerified) await storage.markEmailVerified(user.id);
    return res.json({ ok: true, sessionToken: user.token, role: user.role });
  });

  /* ---------- Auth (legacy magic link — disabled in prod) ---------- */

  // Kept for /api/me + admin scripts; no longer exposed in the SignIn UI.
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
    const result = await sendMagicLinkEmail({
      to: user.email,
      name: user.name,
      token: user.token,
      role: user.role,
    });
    if (emailEnabled && result.sent) {
      // Production: never leak the token back to the client.
      return res.json({ ok: true, emailStubbed: false });
    }
    // Dev / unconfigured fallback: surface the link so local sign-in still works.
    return res.json({
      ok: true,
      link: result.link,
      token: user.token,
      emailStubbed: true,
      error: result.sent ? undefined : (result as any).error,
    });
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

  // Directory + detail are gated behind an active buyer pass.
  app.get("/api/listings", async (req: Request, res: Response) => {
    const user = await requireActivePass(req, res);
    if (!user) return;
    res.json(await storage.getVisibleListingsWithDetails());
  });

  app.get("/api/listings/:id", async (req: Request, res: Response) => {
    const user = await requireActivePass(req, res);
    if (!user) return;
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

  // Health-check alias — unauthenticated, returns count only so Railway probes pass.
  app.get("/api/tuners", async (_req: Request, res: Response) => {
    const listings = await storage.getVisibleListings();
    res.json({ count: listings.length, status: "ok" });
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

  // Replace the current tuner's services in one shot. Auth via session token.
  app.put("/api/me/services", async (req: Request, res: Response) => {
    const token = (req.body?.token as string | undefined) || (req.query.token as string | undefined);
    const user = token ? await storage.getUserByToken(token) : undefined;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (user.role !== "tuner") return res.status(403).json({ message: "Tuner only" });
    const listing = await storage.getListingByUserId(user.id);
    if (!listing) return res.status(404).json({ message: "No listing found for this account." });

    const schema = z.object({
      services: z.array(z.object({
        category: z.enum(serviceCategories as unknown as [string, ...string[]]),
        name: z.string().min(1).max(120),
        description: z.string().max(500).optional().default(""),
        price: z.number().int().min(0).max(1_000_000),
      })).max(20),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid services" });
    }

    // Replace all services for this listing.
    const existing = await storage.getServicesByListing(listing.id);
    for (const s of existing) await storage.deleteService(s.id);
    for (const s of parsed.data.services) {
      await storage.createService({
        listingId: listing.id,
        name: s.name,
        description: s.description ?? "",
        price: s.price,
        category: s.category,
      });
    }
    const next = await storage.getServicesByListing(listing.id);
    res.json({ ok: true, services: next });
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
    const user = await requireActivePass(req, res);
    if (!user) return;
    const parsed = createBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message || "Invalid booking";
      return res.status(400).json({ message: msg });
    }
    const data = parsed.data;
    const listing = await storage.getListing(data.listingId);
    if (!listing) return res.status(404).json({ message: "Listing not found" });

    // No platform fee — buyer & tuner arrange payment directly. The $10 pass is the only fee.
    const booking = await storage.createBooking({
      customerId: data.customerId,
      tunerId: listing.userId,
      listingId: data.listingId,
      serviceId: data.serviceId ?? null,
      vehicleId: data.vehicleId,
      status: "requested",
      subtotal: data.subtotal,
      serviceFee: 0,
      total: data.subtotal,
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

  /* ---------- Buyer access pass ($10 / 30 days) ---------- */

  // GET current pass status for the signed-in buyer.
  app.get("/api/buyer/pass", async (req: Request, res: Response) => {
    const token = req.query.token as string | undefined;
    if (!token) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserByToken(token);
    if (!user) return res.status(401).json({ message: "Invalid session" });
    res.json({
      active: hasActivePass(user),
      passExpiresAt: user.passExpiresAt ?? null,
      role: user.role,
    });
  });

  // $10 / 30-day pass purchase. Live Stripe Checkout when STRIPE_SECRET_KEY is set,
  // otherwise grants the pass instantly (demo / local dev).
  app.post("/api/buyer/pass/checkout", async (req: Request, res: Response) => {
    const token = req.body?.token as string | undefined;
    if (!token) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserByToken(token);
    if (!user) return res.status(401).json({ message: "Invalid session" });

    const stripe = getStripe();
    if (stripe) {
      try {
        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          payment_method_types: ["card"],
          line_items: [{ price: BUYER_PASS_PRICE_ID, quantity: 1 }],
          customer_email: user.email,
          client_reference_id: String(user.id),
          metadata: { kind: "buyer_pass", userId: String(user.id) },
          success_url: `${siteUrl()}/#/account?pass=success`,
          cancel_url: `${siteUrl()}/#/tuners?pass=cancelled`,
        });
        return res.json({ ok: true, url: session.url, sessionId: session.id });
      } catch (e: any) {
        console.error("Stripe pass checkout failed:", e?.message);
        return res.status(500).json({ message: "Couldn't start checkout", detail: e?.message });
      }
    }

    // Fallback: instant grant (no Stripe configured)
    const newExpiry = Math.max(user.passExpiresAt || 0, Date.now()) + PASS_MS;
    const updated = await storage.setBuyerPass(user.id, newExpiry);
    res.json({ ok: true, demoMode: true, passExpiresAt: newExpiry, user: updated });
  });

  /* ---------- Promo codes (app-side) ---------- */

  // Preview a promo code without redeeming. Returns what the code does for the
  // current user (buyer pass days or tuner trial days), or an error explaining
  // why it's not usable for them.
  app.post("/api/promo/preview", async (req: Request, res: Response) => {
    const token = req.body?.token as string | undefined;
    const code = (req.body?.code as string | undefined)?.trim();
    if (!token) return res.status(401).json({ message: "Unauthorized" });
    if (!code) return res.status(400).json({ message: "Missing code" });
    const user = await storage.getUserByToken(token);
    if (!user) return res.status(401).json({ message: "Invalid session" });

    const promo = await storage.getPromoCodeByCode(code);
    if (!promo || !promo.active) {
      return res.status(404).json({ message: "That code isn't valid" });
    }
    if (promo.expiresAt && promo.expiresAt < Date.now()) {
      return res.status(410).json({ message: "That code has expired" });
    }

    const role: "buyer" | "tuner" | null =
      user.role === "customer" ? "buyer" : user.role === "tuner" ? "tuner" : null;
    if (!role) {
      return res.status(400).json({ message: "Promo codes don't apply to this account" });
    }

    const days = role === "buyer" ? promo.buyerPassDays : promo.tunerTrialDays;
    const cap = role === "buyer" ? promo.buyerMaxRedemptions : promo.tunerMaxRedemptions;
    const used = role === "buyer" ? promo.buyerRedemptions : promo.tunerRedemptions;
    if (days <= 0 || cap <= 0) {
      return res.status(400).json({ message: "That code isn't valid for your account type" });
    }
    if (used >= cap) {
      return res.status(409).json({ message: "That code is fully redeemed" });
    }

    const existing = await storage.getPromoRedemption(user.id, promo.id, role);
    if (existing) {
      return res.status(409).json({ message: "You've already used this code" });
    }
    if (promo.firstTimeOnly) {
      if (role === "buyer" && user.passExpiresAt) {
        return res.status(409).json({ message: "First-time buyers only" });
      }
      if (role === "tuner" && user.hostSubscriptionStatus && user.hostSubscriptionStatus !== "inactive") {
        return res.status(409).json({ message: "First-time tuners only" });
      }
    }

    res.json({
      ok: true,
      code: promo.code,
      role,
      buyerPassDays: role === "buyer" ? days : 0,
      tunerTrialDays: role === "tuner" ? days : 0,
    });
  });

  // Redeem a promo code. Buyer: grant a free pass instantly. Tuner: create a
  // Stripe subscription Checkout with trial_period_days so the card is captured
  // up front but the first charge is delayed.
  app.post("/api/promo/redeem", async (req: Request, res: Response) => {
    const token = req.body?.token as string | undefined;
    const code = (req.body?.code as string | undefined)?.trim();
    if (!token) return res.status(401).json({ message: "Unauthorized" });
    if (!code) return res.status(400).json({ message: "Missing code" });
    const user = await storage.getUserByToken(token);
    if (!user) return res.status(401).json({ message: "Invalid session" });

    const promo = await storage.getPromoCodeByCode(code);
    if (!promo || !promo.active) {
      return res.status(404).json({ message: "That code isn't valid" });
    }
    if (promo.expiresAt && promo.expiresAt < Date.now()) {
      return res.status(410).json({ message: "That code has expired" });
    }

    const role: "buyer" | "tuner" | null =
      user.role === "customer" ? "buyer" : user.role === "tuner" ? "tuner" : null;
    if (!role) {
      return res.status(400).json({ message: "Promo codes don't apply to this account" });
    }

    const days = role === "buyer" ? promo.buyerPassDays : promo.tunerTrialDays;
    const cap = role === "buyer" ? promo.buyerMaxRedemptions : promo.tunerMaxRedemptions;
    const used = role === "buyer" ? promo.buyerRedemptions : promo.tunerRedemptions;
    if (days <= 0 || cap <= 0) {
      return res.status(400).json({ message: "That code isn't valid for your account type" });
    }
    if (used >= cap) {
      return res.status(409).json({ message: "That code is fully redeemed" });
    }
    const existing = await storage.getPromoRedemption(user.id, promo.id, role);
    if (existing) {
      return res.status(409).json({ message: "You've already used this code" });
    }
    if (promo.firstTimeOnly) {
      if (role === "buyer" && user.passExpiresAt) {
        return res.status(409).json({ message: "First-time buyers only" });
      }
      if (role === "tuner" && user.hostSubscriptionStatus && user.hostSubscriptionStatus !== "inactive") {
        return res.status(409).json({ message: "First-time tuners only" });
      }
    }

    if (role === "buyer") {
      // Grant the free pass immediately, no Stripe charge.
      const newExpiry = Math.max(user.passExpiresAt || 0, Date.now()) + days * 24 * 60 * 60 * 1000;
      let updated;
      try {
        await storage.redeemPromo(user.id, promo.id, role);
        updated = await storage.setBuyerPass(user.id, newExpiry);
      } catch (e: any) {
        // Likely a unique constraint race on duplicate redemption
        return res.status(409).json({ message: "You've already used this code" });
      }
      return res.json({
        ok: true,
        kind: "buyer_pass_granted",
        passExpiresAt: newExpiry,
        user: updated,
      });
    }

    // Tuner: needs a Stripe subscription with a free trial.
    const stripe = getStripe();
    if (!stripe) {
      // Demo fallback: just mark active for the trial window.
      const periodEnd = Date.now() + days * 24 * 60 * 60 * 1000;
      try {
        await storage.redeemPromo(user.id, promo.id, role);
        await storage.upsertSubscription(user.id, "active", periodEnd);
        await storage.setHostSubscription(user.id, "active");
      } catch (e: any) {
        return res.status(409).json({ message: "You've already used this code" });
      }
      return res.json({ ok: true, kind: "tuner_trial_granted", demoMode: true, currentPeriodEnd: periodEnd });
    }

    try {
      // Record the redemption BEFORE creating Checkout so the cap is enforced
      // even if the user abandons checkout. If they abandon, they've still used
      // their one shot at FOUNDERS — that's the intended behavior.
      await storage.redeemPromo(user.id, promo.id, role);
    } catch (e: any) {
      return res.status(409).json({ message: "You've already used this code" });
    }

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: TUNER_SUB_PRICE_ID, quantity: 1 }],
        customer_email: user.email,
        client_reference_id: String(user.id),
        metadata: { kind: "tuner_sub", userId: String(user.id), promo: promo.code },
        subscription_data: {
          trial_period_days: days,
          metadata: { userId: String(user.id), promo: promo.code },
        },
        success_url: `${siteUrl()}/#/dashboard/tuner?sub=success&promo=${encodeURIComponent(promo.code)}`,
        cancel_url: `${siteUrl()}/#/dashboard/tuner?sub=cancelled`,
      });
      return res.json({
        ok: true,
        kind: "tuner_trial_checkout",
        url: session.url,
        sessionId: session.id,
        trialDays: days,
      });
    } catch (e: any) {
      console.error("Stripe FOUNDERS trial checkout failed:", e?.message);
      return res.status(500).json({ message: "Couldn't start checkout", detail: e?.message });
    }
  });

  /* ---------- Reviews (two-way, booking-gated) ---------- */

  // Submit a review for a completed booking.
  // The author must be either the customer or the tuner of the booking.
  app.post("/api/reviews", async (req: Request, res: Response) => {
    const token = (req.body?.token as string | undefined) || (req.query.token as string | undefined);
    const user = token ? await storage.getUserByToken(token) : undefined;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const parsed = createReviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid review" });
    }
    const { bookingId, rating, comment } = parsed.data;

    const booking = await storage.getBooking(bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.status !== "completed") {
      return res.status(400).json({ message: "You can only review a completed booking." });
    }

    let direction: "customer_to_tuner" | "tuner_to_customer";
    let revieweeUserId: number;
    if (user.id === booking.customerId) {
      direction = "customer_to_tuner";
      revieweeUserId = booking.tunerId;
    } else if (user.id === booking.tunerId) {
      direction = "tuner_to_customer";
      revieweeUserId = booking.customerId;
    } else {
      return res.status(403).json({ message: "You weren't part of this booking." });
    }

    // One review per direction per booking.
    const existing = await storage.getReviewByBookingDirection(bookingId, direction);
    if (existing) {
      return res.status(409).json({ message: "You've already reviewed this booking." });
    }

    const created = await storage.createReview({
      bookingId,
      customerId: booking.customerId,
      listingId: booking.listingId,
      authorUserId: user.id,
      revieweeUserId,
      direction,
      rating,
      comment,
      authorName: user.name,
    } as any);
    res.json(created);
  });

  // Public driver profile — anyone with an active pass can see it.
  app.get("/api/drivers/:id", async (req: Request, res: Response) => {
    const user = await requireActivePass(req, res);
    if (!user) return;
    const profile = await storage.getDriverProfile(Number(req.params.id));
    if (!profile) return res.status(404).json({ message: "Driver not found" });
    res.json(profile);
  });

  /* ---------- Capabilities ---------- */

  // Read current tuner's capabilities (auth via session token).
  app.get("/api/me/capabilities", async (req: Request, res: Response) => {
    const token = req.query.token as string | undefined;
    const user = token ? await storage.getUserByToken(token) : undefined;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (user.role !== "tuner") return res.status(403).json({ message: "Tuner only" });
    const listing = await storage.getListingByUserId(user.id);
    if (!listing) return res.json([]);
    res.json(await storage.getCapabilitiesByListing(listing.id));
  });

  // Replace current tuner's capabilities in one shot.
  app.put("/api/me/capabilities", async (req: Request, res: Response) => {
    const token = (req.body?.token as string | undefined) || (req.query.token as string | undefined);
    const user = token ? await storage.getUserByToken(token) : undefined;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (user.role !== "tuner") return res.status(403).json({ message: "Tuner only" });
    const listing = await storage.getListingByUserId(user.id);
    if (!listing) return res.status(404).json({ message: "No listing found for this account." });

    const allowed: Record<string, readonly string[]> = {
      tuning_type: TUNING_TYPES,
      engine: ENGINES,
      ecu: ECUS,
      fuel: FUELS,
      induction: INDUCTION,
      application: APPLICATIONS,
    };

    const capSchema = z.object({
      capabilities: z.array(z.object({
        groupName: z.enum(capabilityGroups as unknown as [string, ...string[]]),
        value: z.string().min(1).max(40),
        price: z.number().int().min(0).max(1_000_000).nullable().optional(),
      })).max(80),
    });
    const parsed = capSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid capabilities" });
    }

    // Filter to known values for each group.
    const clean = parsed.data.capabilities.filter((c) => allowed[c.groupName]?.includes(c.value));
    // Only tuning_type rows may carry a price.
    const normalized = clean.map((c) => ({
      groupName: c.groupName,
      value: c.value,
      price: c.groupName === "tuning_type" ? (c.price ?? null) : null,
      listingId: listing.id,
    }));

    const rows = await storage.replaceCapabilities(listing.id, normalized as any);
    res.json({ ok: true, capabilities: rows });
  });

  /* ---------- Stripe ---------- */

  // Public config for the frontend (publishable key + whether live).
  app.get("/api/stripe/config", (_req: Request, res: Response) => {
    res.json({ enabled: stripeEnabled(), publishableKey: publishableKey() });
  });

  // Host subscription: $99/year — live Checkout when configured, instant grant in demo.
  app.post("/api/stripe/subscribe", async (req: Request, res: Response) => {
    const token = req.body?.token as string | undefined;
    const user = token ? await storage.getUserByToken(token) : undefined;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const stripe = getStripe();
    if (stripe) {
      try {
        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          payment_method_types: ["card"],
          line_items: [{ price: TUNER_SUB_PRICE_ID, quantity: 1 }],
          customer_email: user.email,
          client_reference_id: String(user.id),
          metadata: { kind: "tuner_sub", userId: String(user.id) },
          subscription_data: { metadata: { userId: String(user.id) } },
          success_url: `${siteUrl()}/#/dashboard/tuner?sub=success`,
          cancel_url: `${siteUrl()}/#/dashboard/tuner?sub=cancelled`,
        });
        return res.json({ ok: true, url: session.url, sessionId: session.id });
      } catch (e: any) {
        console.error("Stripe subscribe failed:", e?.message);
        return res.status(500).json({ message: "Couldn't start subscription", detail: e?.message });
      }
    }

    // Fallback: instant grant
    const periodEnd = Date.now() + YEAR_MS;
    await storage.upsertSubscription(user.id, "active", periodEnd);
    const updated = await storage.setHostSubscription(user.id, "active");
    res.json({ ok: true, demoMode: true, currentPeriodEnd: periodEnd, user: updated });
  });

  // Stripe Connect onboarding (still stubbed — not on the critical path right now).
  app.post("/api/stripe/connect/onboard", async (req: Request, res: Response) => {
    const token = req.body?.token as string | undefined;
    const user = token ? await storage.getUserByToken(token) : undefined;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const updated = await storage.setStripeAccount(user.id, `acct_mock_${user.id}`);
    res.json({ ok: true, demoMode: true, stripeAccountId: updated?.stripeAccountId, user: updated });
  });

  /* ---------- Stripe webhook ---------- */

  // Receives events from Stripe. Mounted at /api/stripe/webhook. Stripe sends JSON
  // but we need the raw bytes for signature verification — server/index.ts already
  // captures req.rawBody for every request via express.json verify hook.
  app.post("/api/stripe/webhook", async (req: Request, res: Response) => {
    const stripe = getStripe();
    const secret = webhookSecret();
    if (!stripe) return res.status(503).json({ message: "Stripe not configured" });
    if (!secret) return res.status(503).json({ message: "Webhook secret missing" });

    const sig = req.headers["stripe-signature"] as string | undefined;
    const raw = (req as any).rawBody as Buffer | undefined;
    if (!sig || !raw) return res.status(400).json({ message: "Missing signature/body" });

    let event: any;
    try {
      event = stripe.webhooks.constructEvent(raw, sig, secret);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err?.message);
      return res.status(400).send(`Webhook Error: ${err?.message}`);
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          const userId = Number(session.metadata?.userId || session.client_reference_id);
          const kind = session.metadata?.kind;
          if (!userId) break;

          if (kind === "buyer_pass") {
            // Find existing pass and extend, or set fresh 30 days from now.
            const user = await storage.getUser(userId);
            const current = user?.passExpiresAt || 0;
            const newExpiry = Math.max(current, Date.now()) + PASS_MS;
            await storage.setBuyerPass(userId, newExpiry);
            // Save Stripe customer id if we got one.
            // (Optional — ignore failure.)
          }

          if (kind === "tuner_sub") {
            const periodEnd = Date.now() + YEAR_MS; // refined below by invoice.paid
            await storage.upsertSubscription(userId, "active", periodEnd);
            await storage.setHostSubscription(userId, "active");
          }
          break;
        }

        case "invoice.paid":
        case "invoice.payment_succeeded": {
          const invoice = event.data.object;
          const userIdRaw = invoice.subscription_details?.metadata?.userId || invoice.metadata?.userId;
          const userId = userIdRaw ? Number(userIdRaw) : null;
          if (userId && invoice.period_end) {
            const periodEnd = invoice.period_end * 1000;
            await storage.upsertSubscription(userId, "active", periodEnd);
            await storage.setHostSubscription(userId, "active");
          }
          break;
        }

        case "customer.subscription.deleted":
        case "customer.subscription.paused": {
          const sub = event.data.object;
          const userId = sub.metadata?.userId ? Number(sub.metadata.userId) : null;
          if (userId) await storage.setHostSubscription(userId, "inactive");
          break;
        }

        default:
          // ignore other events
          break;
      }
      res.json({ received: true });
    } catch (err: any) {
      console.error("Webhook handler error:", err?.message);
      res.status(500).json({ message: "Webhook handler error" });
    }
  });

  return httpServer;
}
