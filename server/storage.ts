import {
  users,
  tunerListings,
  services,
  tunerCapabilities,
  vehicles,
  bookings,
  reviews,
  subscriptions,
  promoCodes,
  promoRedemptions,
  phoneConsultations,
} from "@shared/schema";
import type {
  User,
  InsertUser,
  TunerListing,
  InsertListing,
  Service,
  InsertService,
  TunerCapability,
  InsertCapability,
  Vehicle,
  InsertVehicle,
  Booking,
  Review,
  InsertReview,
  Subscription,
  ListingWithDetails,
  DriverProfile,
  ReviewDirection,
  PromoCode,
  PromoRedemption,
  PhoneConsultation,
  CreateConsult,
  ConsultStatus,
} from "@shared/schema";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  ssl: process.env.DATABASE_URL?.includes("railway.internal")
    ? false
    : { rejectUnauthorized: false },
});

export const db = drizzle(pool, { schema });

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export interface IStorage {
  // users / auth
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByToken(token: string): Promise<User | undefined>;
  createUser(u: InsertUser): Promise<User>;
  // listings
  getListing(id: number): Promise<TunerListing | undefined>;
  getListingByUserId(userId: number): Promise<TunerListing | undefined>;
  getVisibleListings(): Promise<TunerListing[]>;
  getListingWithDetails(id: number): Promise<ListingWithDetails | undefined>;
  getVisibleListingsWithDetails(): Promise<ListingWithDetails[]>;
  updateListing(id: number, patch: Partial<TunerListing>): Promise<TunerListing | undefined>;
  createListing(data: InsertListing): Promise<TunerListing>;
  // services
  getServicesByListing(listingId: number): Promise<Service[]>;
  createService(s: InsertService): Promise<Service>;
  deleteService(id: number): Promise<void>;
  // capabilities
  getCapabilitiesByListing(listingId: number): Promise<TunerCapability[]>;
  replaceCapabilities(listingId: number, caps: InsertCapability[]): Promise<TunerCapability[]>;
  // vehicles
  getVehiclesByUser(userId: number): Promise<Vehicle[]>;
  createVehicle(v: InsertVehicle): Promise<Vehicle>;
  // bookings
  createBooking(b: Omit<Booking, "id">): Promise<Booking>;
  getBooking(id: number): Promise<Booking | undefined>;
  getBookingsByCustomer(customerId: number): Promise<Booking[]>;
  getBookingsByTuner(tunerId: number): Promise<Booking[]>;
  updateBooking(id: number, patch: Partial<Booking>): Promise<Booking | undefined>;
  // reviews
  getReviewsByListing(listingId: number): Promise<Review[]>;
  getReviewsByReviewee(userId: number): Promise<Review[]>;
  getReviewByBookingDirection(bookingId: number, direction: ReviewDirection): Promise<Review | undefined>;
  createReview(r: InsertReview): Promise<Review>;
  // driver profile
  getDriverProfile(userId: number): Promise<DriverProfile | undefined>;
  // subscriptions
  upsertSubscription(userId: number, status: string, currentPeriodEnd: number, stripeSubscriptionId?: string): Promise<Subscription>;
  setHostSubscription(userId: number, status: string): Promise<User | undefined>;
  setStripeAccount(userId: number, accountId: string): Promise<User | undefined>;
  setStripeCustomer(userId: number, customerId: string): Promise<User | undefined>;
  setBuyerPass(userId: number, expiresAt: number): Promise<User | undefined>;
  // password auth
  setPasswordHash(userId: number, hash: string): Promise<User | undefined>;
  setEmailVerifyToken(userId: number, token: string | null): Promise<User | undefined>;
  markEmailVerified(userId: number): Promise<User | undefined>;
  getUserByEmailVerifyToken(token: string): Promise<User | undefined>;
  setPasswordResetToken(userId: number, token: string | null, expiresAt: number | null): Promise<User | undefined>;
  getUserByPasswordResetToken(token: string): Promise<User | undefined>;
  // promo codes
  getPromoCodeByCode(code: string): Promise<PromoCode | undefined>;
  getPromoRedemption(userId: number, promoCodeId: number, role: string): Promise<PromoRedemption | undefined>;
  redeemPromo(userId: number, promoCodeId: number, role: "buyer" | "tuner"): Promise<PromoRedemption>;
  // phone consultations
  createConsult(input: CreateConsult): Promise<PhoneConsultation>;
  getConsultsForDriver(driverId: number): Promise<PhoneConsultation[]>;
  getConsultsForTuner(tunerId: number): Promise<PhoneConsultation[]>;
  getConsultById(id: number): Promise<PhoneConsultation | undefined>;
  updateConsultStatus(id: number, status: ConsultStatus, opts?: { tunerPhone?: string; scheduledAt?: string }): Promise<PhoneConsultation | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number) {
    const rows = await db.select().from(users).where(eq(users.id, id));
    return rows[0];
  }
  async getUserByEmail(email: string) {
    const rows = await db.select().from(users).where(eq(users.email, email));
    return rows[0];
  }
  async getUserByToken(token: string) {
    const rows = await db.select().from(users).where(eq(users.token, token));
    return rows[0];
  }
  async createUser(u: InsertUser) {
    const rows = await db
      .insert(users)
      .values({ ...u, token: randomUUID(), createdAt: Date.now() })
      .returning();
    return rows[0];
  }

  async getListing(id: number) {
    const rows = await db.select().from(tunerListings).where(eq(tunerListings.id, id));
    return rows[0];
  }
  async getListingByUserId(userId: number) {
    const rows = await db.select().from(tunerListings).where(eq(tunerListings.userId, userId));
    return rows[0];
  }
  async getVisibleListings() {
    return db.select().from(tunerListings).where(eq(tunerListings.isVisible, true));
  }
  private async hydrate(l: TunerListing): Promise<ListingWithDetails> {
    const tuner = await this.getUser(l.userId);
    return {
      ...l,
      services: await this.getServicesByListing(l.id),
      reviews: await this.getReviewsByListing(l.id),
      capabilities: await this.getCapabilitiesByListing(l.id),
      tunerName: tuner?.name ?? "Tuner",
    };
  }
  async getListingWithDetails(id: number) {
    const l = await this.getListing(id);
    return l ? this.hydrate(l) : undefined;
  }
  async getVisibleListingsWithDetails() {
    const listings = await this.getVisibleListings();
    return Promise.all(listings.map((l) => this.hydrate(l)));
  }
  async updateListing(id: number, patch: Partial<TunerListing>) {
    const rows = await db
      .update(tunerListings)
      .set(patch)
      .where(eq(tunerListings.id, id))
      .returning();
    return rows[0];
  }

  async createListing(data: InsertListing) {
    const rows = await db.insert(tunerListings).values(data).returning();
    return rows[0];
  }

  async getServicesByListing(listingId: number) {
    return db.select().from(services).where(eq(services.listingId, listingId));
  }
  async createService(s: InsertService) {
    const rows = await db.insert(services).values(s).returning();
    return rows[0];
  }
  async deleteService(id: number) {
    await db.delete(services).where(eq(services.id, id));
  }

  async getCapabilitiesByListing(listingId: number) {
    return db.select().from(tunerCapabilities).where(eq(tunerCapabilities.listingId, listingId));
  }
  async replaceCapabilities(listingId: number, caps: InsertCapability[]) {
    await db.delete(tunerCapabilities).where(eq(tunerCapabilities.listingId, listingId));
    if (caps.length === 0) return [];
    const rows = await db.insert(tunerCapabilities).values(
      caps.map((c) => ({ ...c, listingId })),
    ).returning();
    return rows;
  }

  async getVehiclesByUser(userId: number) {
    return db.select().from(vehicles).where(eq(vehicles.userId, userId));
  }
  async createVehicle(v: InsertVehicle) {
    const rows = await db.insert(vehicles).values(v).returning();
    return rows[0];
  }

  async createBooking(b: Omit<Booking, "id">) {
    const rows = await db.insert(bookings).values(b).returning();
    return rows[0];
  }
  async getBooking(id: number) {
    const rows = await db.select().from(bookings).where(eq(bookings.id, id));
    return rows[0];
  }
  async getBookingsByCustomer(customerId: number) {
    return db.select().from(bookings).where(eq(bookings.customerId, customerId));
  }
  async getBookingsByTuner(tunerId: number) {
    return db.select().from(bookings).where(eq(bookings.tunerId, tunerId));
  }
  async updateBooking(id: number, patch: Partial<Booking>) {
    const rows = await db
      .update(bookings)
      .set(patch)
      .where(eq(bookings.id, id))
      .returning();
    return rows[0];
  }

  async getReviewsByListing(listingId: number) {
    return db
      .select()
      .from(reviews)
      .where(
        and(
          eq(reviews.listingId, listingId),
          // legacy rows have direction NULL but were customer_to_tuner;
          // explicit customer_to_tuner rows also belong here.
          sql`(${reviews.direction} = 'customer_to_tuner' OR ${reviews.direction} IS NULL)`,
        ),
      );
  }
  async getReviewsByReviewee(userId: number) {
    return db.select().from(reviews).where(eq(reviews.revieweeUserId, userId));
  }
  async getReviewByBookingDirection(bookingId: number, direction: ReviewDirection) {
    const rows = await db
      .select()
      .from(reviews)
      .where(and(eq(reviews.bookingId, bookingId), eq(reviews.direction, direction)));
    return rows[0];
  }
  async createReview(r: InsertReview) {
    const rows = await db
      .insert(reviews)
      .values({ ...r, createdAt: Date.now() })
      .returning();
    return rows[0];
  }

  async getDriverProfile(userId: number): Promise<DriverProfile | undefined> {
    const u = await this.getUser(userId);
    if (!u || u.role !== "customer") return undefined;
    const driverVehicles = await this.getVehiclesByUser(userId);
    const driverReviews = await this.getReviewsByReviewee(userId);
    const reviewCount = driverReviews.length;
    const rating = reviewCount === 0
      ? 0
      : Math.round((driverReviews.reduce((s, r) => s + r.rating, 0) / reviewCount) * 10);
    return {
      id: u.id,
      name: u.name,
      vehicles: driverVehicles,
      reviews: driverReviews,
      rating,
      reviewCount,
    };
  }

  async upsertSubscription(userId: number, status: string, currentPeriodEnd: number, stripeSubscriptionId?: string) {
    const existing = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId));
    // Only overwrite the subscription id when we have a real one from Stripe;
    // otherwise preserve whatever is already stored (real id beats mock).
    if (existing[0]) {
      const patch: any = { status, currentPeriodEnd };
      if (stripeSubscriptionId) patch.stripeSubscriptionId = stripeSubscriptionId;
      else if (!existing[0].stripeSubscriptionId) patch.stripeSubscriptionId = `sub_mock_${userId}`;
      const rows = await db
        .update(subscriptions)
        .set(patch)
        .where(eq(subscriptions.id, existing[0].id))
        .returning();
      return rows[0];
    }
    const rows = await db
      .insert(subscriptions)
      .values({ userId, status, currentPeriodEnd, stripeSubscriptionId: stripeSubscriptionId ?? `sub_mock_${userId}` })
      .returning();
    return rows[0];
  }

  async setHostSubscription(userId: number, status: string) {
    const rows = await db
      .update(users)
      .set({ hostSubscriptionStatus: status })
      .where(eq(users.id, userId))
      .returning();
    const u = rows[0];
    // gate listing visibility on subscription
    const listing = await this.getListingByUserId(userId);
    if (listing) {
      await this.updateListing(listing.id, { isVisible: status === "active" });
    }
    return u;
  }

  async setStripeAccount(userId: number, accountId: string) {
    const rows = await db
      .update(users)
      .set({ stripeAccountId: accountId })
      .where(eq(users.id, userId))
      .returning();
    return rows[0];
  }

  async setStripeCustomer(userId: number, customerId: string) {
    const rows = await db
      .update(users)
      .set({ stripeCustomerId: customerId })
      .where(eq(users.id, userId))
      .returning();
    return rows[0];
  }

  async setBuyerPass(userId: number, expiresAt: number) {
    const rows = await db
      .update(users)
      .set({ passExpiresAt: expiresAt })
      .where(eq(users.id, userId))
      .returning();
    return rows[0];
  }

  async setPasswordHash(userId: number, hash: string) {
    const rows = await db.update(users).set({ passwordHash: hash }).where(eq(users.id, userId)).returning();
    return rows[0];
  }
  async setEmailVerifyToken(userId: number, token: string | null) {
    const rows = await db.update(users).set({ emailVerifyToken: token }).where(eq(users.id, userId)).returning();
    return rows[0];
  }
  async markEmailVerified(userId: number) {
    const rows = await db
      .update(users)
      .set({ emailVerified: true, emailVerifyToken: null })
      .where(eq(users.id, userId))
      .returning();
    return rows[0];
  }
  async getUserByEmailVerifyToken(token: string) {
    const rows = await db.select().from(users).where(eq(users.emailVerifyToken, token));
    return rows[0];
  }
  async setPasswordResetToken(userId: number, token: string | null, expiresAt: number | null) {
    const rows = await db
      .update(users)
      .set({ passwordResetToken: token, passwordResetExpiresAt: expiresAt })
      .where(eq(users.id, userId))
      .returning();
    return rows[0];
  }
  async getUserByPasswordResetToken(token: string) {
    const rows = await db.select().from(users).where(eq(users.passwordResetToken, token));
    return rows[0];
  }

  async getPromoCodeByCode(code: string) {
    const rows = await db
      .select()
      .from(promoCodes)
      .where(sql`upper(${promoCodes.code}) = upper(${code})`);
    return rows[0];
  }

  async getPromoRedemption(userId: number, promoCodeId: number, role: string) {
    const rows = await db
      .select()
      .from(promoRedemptions)
      .where(
        and(
          eq(promoRedemptions.userId, userId),
          eq(promoRedemptions.promoCodeId, promoCodeId),
          eq(promoRedemptions.role, role),
        ),
      );
    return rows[0];
  }

  async redeemPromo(userId: number, promoCodeId: number, role: "buyer" | "tuner") {
    // Insert the redemption (unique constraint blocks double-use)
    const inserted = await db
      .insert(promoRedemptions)
      .values({
        userId,
        promoCodeId,
        role,
        createdAt: Date.now(),
      })
      .returning();
    // Increment the right counter
    if (role === "buyer") {
      await db
        .update(promoCodes)
        .set({ buyerRedemptions: sql`${promoCodes.buyerRedemptions} + 1` })
        .where(eq(promoCodes.id, promoCodeId));
    } else {
      await db
        .update(promoCodes)
        .set({ tunerRedemptions: sql`${promoCodes.tunerRedemptions} + 1` })
        .where(eq(promoCodes.id, promoCodeId));
    }
    return inserted[0];
  }

  /* ---------------- Phone Consultations ---------------- */
  async createConsult(input: CreateConsult): Promise<PhoneConsultation> {
    const now = Date.now();
    const [row] = await db
      .insert(phoneConsultations)
      .values({
        driverId: input.driverId,
        tunerId: input.tunerId,
        driverPhone: input.driverPhone,
        topic: input.topic,
        preferredTime: input.preferredTime,
        status: "requested",
        priceCents: 12500,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return row;
  }

  async getConsultsForDriver(driverId: number): Promise<PhoneConsultation[]> {
    return await db
      .select()
      .from(phoneConsultations)
      .where(eq(phoneConsultations.driverId, driverId))
      .orderBy(desc(phoneConsultations.createdAt));
  }

  async getConsultsForTuner(tunerId: number): Promise<PhoneConsultation[]> {
    return await db
      .select()
      .from(phoneConsultations)
      .where(eq(phoneConsultations.tunerId, tunerId))
      .orderBy(desc(phoneConsultations.createdAt));
  }

  async getConsultById(id: number): Promise<PhoneConsultation | undefined> {
    const [row] = await db
      .select()
      .from(phoneConsultations)
      .where(eq(phoneConsultations.id, id));
    return row;
  }

  async updateConsultStatus(
    id: number,
    status: ConsultStatus,
    opts?: { tunerPhone?: string; scheduledAt?: string }
  ): Promise<PhoneConsultation | undefined> {
    const patch: Record<string, unknown> = { status, updatedAt: Date.now() };
    if (opts?.tunerPhone !== undefined) patch.tunerPhone = opts.tunerPhone;
    if (opts?.scheduledAt !== undefined) patch.scheduledAt = opts.scheduledAt;
    const [row] = await db
      .update(phoneConsultations)
      .set(patch)
      .where(eq(phoneConsultations.id, id))
      .returning();
    return row;
  }
}

export const storage = new DatabaseStorage();

/* ---------------- Schema bootstrap + seed ---------------- */
export async function initDb() {
  // Run drizzle migrations
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const pathMod = await import("node:path");
  // In dev (tsx from project root): migrations at ./migrations/
  // In production (node dist/index.cjs): migrations at ./dist/migrations/ (copied by build script)
  const migrationsFolder = process.env.NODE_ENV === "production"
    ? pathMod.join(process.cwd(), "dist", "migrations")
    : pathMod.join(process.cwd(), "migrations");
  await migrate(db, { migrationsFolder });
  console.log("[db] migrations applied");

  // Seed only if explicitly requested
  if (process.env.SEED_DEMO_DATA === "1") {
    const existing = await db.select().from(users);
    if (existing.length === 0) {
      await seed();
    }
  }
}

async function seed() {
  const now = Date.now();
  const periodEnd = now + YEAR_MS;

  type TunerSeed = {
    email: string;
    name: string;
    sub: "active" | "inactive";
    shopName: string;
    location: string;
    bio: string;
    dyno: boolean;
    remote: boolean;
    makes: string[];
    startingPrice: number;
    rating: number;
    reviewCount: number;
    hero: string | null;
    services: { name: string; description: string; price: number; category: string }[];
  };

  const tuners: TunerSeed[] = [
    {
      email: "tuner@apexcal.com",
      name: "Marcus Vega",
      sub: "active",
      shopName: "Apex Calibrations",
      location: "Phoenix, AZ",
      bio: "GM LS/LT specialists with 12+ years calibrating boosted and flex-fuel street cars. In-house Mustang dyno plus full remote support for HP Tuners platforms. We focus on repeatable power and clean drivability.",
      dyno: true,
      remote: true,
      makes: ["GM", "Chevrolet", "Cadillac"],
      startingPrice: 450,
      rating: 49,
      reviewCount: 3,
      hero: "dyno",
      services: [
        { name: "LS/LT Dyno Tune", description: "Full in-person dyno session for naturally aspirated and boosted GM builds. Includes drivability, WOT, and part-throttle calibration.", price: 850, category: "dyno" },
        { name: "Remote E-Tune Package", description: "File-based remote tuning with datalog review and unlimited revisions for 30 days. Ideal for HP Tuners equipped cars.", price: 450, category: "remote" },
        { name: "Flex-Fuel + TCM Calibration", description: "Add flex-fuel blending and 6L/8L/10L transmission calibration for crisp shifts and torque management.", price: 650, category: "tcm" },
      ],
    },
    {
      email: "tuner@nordschleife.de",
      name: "Lena Brandt",
      sub: "active",
      shopName: "Nordschleife Performance",
      location: "Austin, TX",
      bio: "BMW, VW and Audi Euro specialists. We dial in N54/N55/B58, EA888, and DSG/DCT platforms for daily reliability and track repeatability. MHD, bootmod3, and bench flashing in-house.",
      dyno: true,
      remote: true,
      makes: ["BMW", "VW", "Audi"],
      startingPrice: 500,
      rating: 50,
      reviewCount: 2,
      hero: "ecu",
      services: [
        { name: "B58 / N55 Stage 2 Tune", description: "Custom map for downpipe + intake equipped BMW. Includes datalogging support and a follow-up revision.", price: 700, category: "ecu" },
        { name: "DSG / DCT Transmission Tune", description: "Faster shifts, raised torque limits, launch control and clutch optimization for VW/Audi dual-clutch boxes.", price: 550, category: "tcm" },
        { name: "Remote Diagnostics Session", description: "Live remote session to read logs, chase a drivability fault, and verify a healthy baseline before tuning.", price: 180, category: "diagnostics" },
      ],
    },
    {
      email: "tuner@boxerworks.com",
      name: "Kenji Sato",
      sub: "active",
      shopName: "BoxerWorks Tuning",
      location: "Portland, OR",
      bio: "Subaru EJ and FA specialists. Protuned street and stage builds, COBB and OpenECU workflows, plus full build support for big-turbo setups. Remote-first shop with partner dyno access.",
      dyno: false,
      remote: true,
      makes: ["Subaru"],
      startingPrice: 400,
      rating: 48,
      reviewCount: 2,
      hero: null,
      services: [
        { name: "Subaru Stage 1/2 Remote Tune", description: "COBB Accessport remote protune for bolt-on WRX/STI builds, with datalog-driven revisions.", price: 400, category: "remote" },
        { name: "Big Turbo Build Support", description: "End-to-end support for injector, turbo, and fueling upgrades including base map and calibration plan.", price: 950, category: "build_support" },
        { name: "EJ Engine Diagnostics", description: "Knock, AFR and boost-control troubleshooting from your logs with a written action plan.", price: 150, category: "diagnostics" },
      ],
    },
    {
      email: "tuner@torquelab.com",
      name: "Dale Rourke",
      sub: "active",
      shopName: "TorqueLab Diesel",
      location: "Denver, CO",
      bio: "Heavy-duty diesel calibration for towing, daily driving and sled-pull builds. Cummins, Power Stroke and Duramax ECM/TCM work with EGT-safe, reliability-first maps.",
      dyno: true,
      remote: true,
      makes: ["Ram", "Ford", "GM", "Diesel"],
      startingPrice: 600,
      rating: 47,
      reviewCount: 1,
      hero: null,
      services: [
        { name: "Towing Calibration Package", description: "EGT-conscious tow tune with improved throttle response and transmission strategy for 3/4 and 1-ton trucks.", price: 600, category: "ecu" },
        { name: "Allison / 68RFE TCM Tune", description: "Firm, reliable shifts and raised line pressure for heavy towing and added torque.", price: 500, category: "tcm" },
        { name: "Dyno Performance Session", description: "In-person dyno calibration for built diesels chasing measured, repeatable power.", price: 900, category: "dyno" },
      ],
    },
    {
      email: "tuner@rbmotorsport.com",
      name: "Priya Anand",
      sub: "active",
      shopName: "RB Motorsport",
      location: "Los Angeles, CA",
      bio: "Nissan and JDM specialists. RB, VR, VQ and SR platforms, standalone and factory ECU work. From clean street GT-Rs to dedicated race setups, we build calibrations that hold up.",
      dyno: true,
      remote: false,
      makes: ["Nissan", "Infiniti"],
      startingPrice: 750,
      rating: 50,
      reviewCount: 1,
      hero: null,
      services: [
        { name: "GT-R Dyno Calibration", description: "VR38 dyno tune for bolt-on and built R35 GT-Rs, including boost-by-gear and trans temp strategy.", price: 1200, category: "dyno" },
        { name: "Standalone ECU Setup", description: "Base map and full configuration for Haltech/MoTeC on RB and SR swap builds.", price: 1100, category: "ecu" },
        { name: "Race Day Setup", description: "Track-focused calibration with multiple maps, fuel strategy, and safety thresholds for race weekends.", price: 950, category: "race_setup" },
      ],
    },
    {
      email: "tuner@maxeffort.com",
      name: "Tony Greco",
      sub: "inactive",
      shopName: "Max Effort Mopar (pending subscription)",
      location: "Detroit, MI",
      bio: "Hemi and Hellcat specialists. Pulley setups, E85 conversions and PCM calibration. (This listing is hidden until the host subscription is active — demonstrates subscription gating.)",
      dyno: true,
      remote: true,
      makes: ["Dodge", "Jeep", "Chrysler", "Mopar"],
      startingPrice: 550,
      rating: 46,
      reviewCount: 0,
      hero: null,
      services: [
        { name: "Hellcat Pulley + Tune", description: "Upper/lower pulley calibration with safe boost targets and E85 blends.", price: 750, category: "ecu" },
      ],
    },
  ];

  const tunerUserIds: number[] = [];
  for (const t of tuners) {
    const u = await storage.createUser({
      email: t.email,
      name: t.name,
      role: "tuner",
      stripeCustomerId: null,
      stripeAccountId: t.sub === "active" ? `acct_mock_seed_${t.email}` : null,
      hostSubscriptionStatus: t.sub,
    } as any);
    tunerUserIds.push(u.id);
    const listingRows = await db
      .insert(tunerListings)
      .values({
        userId: u.id,
        shopName: t.shopName,
        location: t.location,
        bio: t.bio,
        dynoAvailable: t.dyno,
        remoteAvailable: t.remote,
        supportedMakes: t.makes,
        startingPrice: t.startingPrice,
        rating: t.rating,
        reviewCount: t.reviewCount,
        heroImage: t.hero,
        isVisible: t.sub === "active",
      })
      .returning();
    const listing = listingRows[0];
    for (const s of t.services) {
      await storage.createService({ listingId: listing.id, ...s });
    }
    if (t.sub === "active") {
      await storage.upsertSubscription(u.id, "active", periodEnd);
    }
  }

  // Customers
  const cust1 = await storage.createUser({
    email: "driver@tunersamerica.com",
    name: "Sam Okafor",
    role: "customer",
    stripeCustomerId: "cus_mock_seed_1",
    stripeAccountId: null,
    hostSubscriptionStatus: null,
  } as any);
  const cust2 = await storage.createUser({
    email: "alex@tunersamerica.com",
    name: "Alex Rivera",
    role: "customer",
    stripeCustomerId: "cus_mock_seed_2",
    stripeAccountId: null,
    hostSubscriptionStatus: null,
  } as any);

  await storage.createVehicle({
    userId: cust1.id,
    year: 2019,
    make: "Chevrolet",
    model: "Camaro SS",
    modifications: "Long-tube headers, cold air intake, 93 octane",
    fuelType: "Pump gas (93)",
  });
  await storage.createVehicle({
    userId: cust2.id,
    year: 2021,
    make: "BMW",
    model: "M340i (G20)",
    modifications: "Downpipe, intake, FMIC",
    fuelType: "Pump gas (91)",
  });

  // Reviews (listings 1,2,3,4,5)
  const reviewSeed = [
    { listingId: 1, name: "Chris D.", rating: 5, comment: "Marcus dialed in my boosted LS perfectly. Drives like stock until you get on it. Logs reviewed same day." },
    { listingId: 1, name: "Jenna P.", rating: 5, comment: "Remote e-tune package was worth every dollar. Quick revisions and clear instructions." },
    { listingId: 1, name: "Omar T.", rating: 4, comment: "Solid flex-fuel calibration. Shifts are much crisper after the TCM work." },
    { listingId: 2, name: "Daniel K.", rating: 5, comment: "Nordschleife knows the B58 inside out. Track temps stayed in check all weekend." },
    { listingId: 2, name: "Sofia R.", rating: 5, comment: "DSG tune transformed the car. Launch control is addictive." },
    { listingId: 3, name: "Mike W.", rating: 5, comment: "Kenji's big turbo build support kept my project on the rails. Great communication." },
    { listingId: 3, name: "Hana L.", rating: 4, comment: "Remote Subaru protune was smooth. Would book again." },
    { listingId: 4, name: "Buck R.", rating: 5, comment: "Tow tune dropped my EGTs and the truck pulls way better up the grade." },
    { listingId: 5, name: "Yuki N.", rating: 5, comment: "RB Motorsport's GT-R dyno session was flawless. Repeatable numbers, safe targets." },
  ];
  for (const r of reviewSeed) {
    await storage.createReview({
      bookingId: null,
      customerId: cust1.id,
      listingId: r.listingId,
      rating: r.rating,
      comment: r.comment,
      authorName: r.name,
    } as any);
  }

  // A sample booking for customer 1 with Apex (listing 1, service 2 = remote)
  const sub = 450;
  await storage.createBooking({
    customerId: cust1.id,
    tunerId: tunerUserIds[0],
    listingId: 1,
    serviceId: 2,
    vehicleId: 1,
    status: "accepted",
    subtotal: sub,
    serviceFee: 0,
    total: sub,
    insuranceAcknowledged: true,
    paid: true,
    notes: "Looking to refine part-throttle drivability on 93 octane.",
    createdAt: now - 3 * 24 * 60 * 60 * 1000,
  });
}
