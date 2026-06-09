import {
  users,
  tunerListings,
  services,
  vehicles,
  bookings,
  reviews,
  subscriptions,
} from "@shared/schema";
import type {
  User,
  InsertUser,
  TunerListing,
  InsertListing,
  Service,
  InsertService,
  Vehicle,
  InsertVehicle,
  Booking,
  Review,
  InsertReview,
  Subscription,
  ListingWithDetails,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "node:crypto";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");
export const db = drizzle(sqlite);

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export interface IStorage {
  // users / auth
  getUser(id: number): User | undefined;
  getUserByEmail(email: string): User | undefined;
  getUserByToken(token: string): User | undefined;
  createUser(u: InsertUser): User;
  // listings
  getListing(id: number): TunerListing | undefined;
  getListingByUserId(userId: number): TunerListing | undefined;
  getVisibleListings(): TunerListing[];
  getListingWithDetails(id: number): ListingWithDetails | undefined;
  getVisibleListingsWithDetails(): ListingWithDetails[];
  updateListing(id: number, patch: Partial<TunerListing>): TunerListing | undefined;
  // services
  getServicesByListing(listingId: number): Service[];
  createService(s: InsertService): Service;
  deleteService(id: number): void;
  // vehicles
  getVehiclesByUser(userId: number): Vehicle[];
  createVehicle(v: InsertVehicle): Vehicle;
  // bookings
  createBooking(b: Omit<Booking, "id">): Booking;
  getBooking(id: number): Booking | undefined;
  getBookingsByCustomer(customerId: number): Booking[];
  getBookingsByTuner(tunerId: number): Booking[];
  updateBooking(id: number, patch: Partial<Booking>): Booking | undefined;
  // reviews
  getReviewsByListing(listingId: number): Review[];
  createReview(r: InsertReview): Review;
  // subscriptions
  upsertSubscription(userId: number, status: string, currentPeriodEnd: number): Subscription;
  setHostSubscription(userId: number, status: string): User | undefined;
  setStripeAccount(userId: number, accountId: string): User | undefined;
}

export class DatabaseStorage implements IStorage {
  getUser(id: number) {
    return db.select().from(users).where(eq(users.id, id)).get();
  }
  getUserByEmail(email: string) {
    return db.select().from(users).where(eq(users.email, email)).get();
  }
  getUserByToken(token: string) {
    return db.select().from(users).where(eq(users.token, token)).get();
  }
  createUser(u: InsertUser) {
    return db
      .insert(users)
      .values({ ...u, token: randomUUID(), createdAt: Date.now() })
      .returning()
      .get();
  }

  getListing(id: number) {
    return db.select().from(tunerListings).where(eq(tunerListings.id, id)).get();
  }
  getListingByUserId(userId: number) {
    return db.select().from(tunerListings).where(eq(tunerListings.userId, userId)).get();
  }
  getVisibleListings() {
    return db.select().from(tunerListings).where(eq(tunerListings.isVisible, true)).all();
  }
  private hydrate(l: TunerListing): ListingWithDetails {
    const tuner = this.getUser(l.userId);
    return {
      ...l,
      services: this.getServicesByListing(l.id),
      reviews: this.getReviewsByListing(l.id),
      tunerName: tuner?.name ?? "Tuner",
    };
  }
  getListingWithDetails(id: number) {
    const l = this.getListing(id);
    return l ? this.hydrate(l) : undefined;
  }
  getVisibleListingsWithDetails() {
    return this.getVisibleListings().map((l) => this.hydrate(l));
  }
  updateListing(id: number, patch: Partial<TunerListing>) {
    return db.update(tunerListings).set(patch).where(eq(tunerListings.id, id)).returning().get();
  }

  getServicesByListing(listingId: number) {
    return db.select().from(services).where(eq(services.listingId, listingId)).all();
  }
  createService(s: InsertService) {
    return db.insert(services).values(s).returning().get();
  }
  deleteService(id: number) {
    db.delete(services).where(eq(services.id, id)).run();
  }

  getVehiclesByUser(userId: number) {
    return db.select().from(vehicles).where(eq(vehicles.userId, userId)).all();
  }
  createVehicle(v: InsertVehicle) {
    return db.insert(vehicles).values(v).returning().get();
  }

  createBooking(b: Omit<Booking, "id">) {
    return db.insert(bookings).values(b).returning().get();
  }
  getBooking(id: number) {
    return db.select().from(bookings).where(eq(bookings.id, id)).get();
  }
  getBookingsByCustomer(customerId: number) {
    return db.select().from(bookings).where(eq(bookings.customerId, customerId)).all();
  }
  getBookingsByTuner(tunerId: number) {
    return db.select().from(bookings).where(eq(bookings.tunerId, tunerId)).all();
  }
  updateBooking(id: number, patch: Partial<Booking>) {
    return db.update(bookings).set(patch).where(eq(bookings.id, id)).returning().get();
  }

  getReviewsByListing(listingId: number) {
    return db.select().from(reviews).where(eq(reviews.listingId, listingId)).all();
  }
  createReview(r: InsertReview) {
    return db.insert(reviews).values({ ...r, createdAt: Date.now() }).returning().get();
  }

  upsertSubscription(userId: number, status: string, currentPeriodEnd: number) {
    const existing = db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).get();
    if (existing) {
      return db
        .update(subscriptions)
        .set({ status, currentPeriodEnd, stripeSubscriptionId: `sub_mock_${userId}` })
        .where(eq(subscriptions.id, existing.id))
        .returning()
        .get();
    }
    return db
      .insert(subscriptions)
      .values({ userId, status, currentPeriodEnd, stripeSubscriptionId: `sub_mock_${userId}` })
      .returning()
      .get();
  }
  setHostSubscription(userId: number, status: string) {
    const u = db
      .update(users)
      .set({ hostSubscriptionStatus: status })
      .where(eq(users.id, userId))
      .returning()
      .get();
    // gate listing visibility on subscription
    const listing = this.getListingByUserId(userId);
    if (listing) {
      this.updateListing(listing.id, { isVisible: status === "active" });
    }
    return u;
  }
  setStripeAccount(userId: number, accountId: string) {
    return db
      .update(users)
      .set({ stripeAccountId: accountId })
      .where(eq(users.id, userId))
      .returning()
      .get();
  }
}

export const storage = new DatabaseStorage();

/* ---------------- Schema bootstrap + seed ---------------- */
export function initDb() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      token TEXT NOT NULL,
      stripe_customer_id TEXT,
      stripe_account_id TEXT,
      host_subscription_status TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tuner_listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      shop_name TEXT NOT NULL,
      location TEXT NOT NULL,
      bio TEXT NOT NULL,
      dyno_available INTEGER NOT NULL DEFAULT 0,
      remote_available INTEGER NOT NULL DEFAULT 0,
      supported_makes TEXT NOT NULL,
      starting_price INTEGER NOT NULL,
      rating INTEGER NOT NULL DEFAULT 50,
      review_count INTEGER NOT NULL DEFAULT 0,
      hero_image TEXT,
      is_visible INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      price INTEGER NOT NULL,
      category TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      make TEXT NOT NULL,
      model TEXT NOT NULL,
      modifications TEXT NOT NULL DEFAULT '',
      fuel_type TEXT NOT NULL DEFAULT 'Pump gas'
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      tuner_id INTEGER NOT NULL,
      listing_id INTEGER NOT NULL,
      service_id INTEGER,
      vehicle_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'requested',
      subtotal INTEGER NOT NULL,
      service_fee INTEGER NOT NULL,
      total INTEGER NOT NULL,
      insurance_acknowledged INTEGER NOT NULL DEFAULT 0,
      paid INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER,
      customer_id INTEGER NOT NULL,
      listing_id INTEGER NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT NOT NULL,
      author_name TEXT NOT NULL DEFAULT 'Customer',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      current_period_end INTEGER,
      stripe_subscription_id TEXT
    );
  `);

  const existing = db.select().from(users).all();
  if (existing.length > 0) return;

  seed();
}

function seed() {
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
    const u = storage.createUser({
      email: t.email,
      name: t.name,
      role: "tuner",
      stripeCustomerId: null,
      stripeAccountId: t.sub === "active" ? `acct_mock_seed_${t.email}` : null,
      hostSubscriptionStatus: t.sub,
    } as any);
    tunerUserIds.push(u.id);
    const listing = db
      .insert(tunerListings)
      .values({
        userId: u.id,
        shopName: t.shopName,
        location: t.location,
        bio: t.bio,
        dynoAvailable: t.dyno,
        remoteAvailable: t.remote,
        supportedMakes: JSON.stringify(t.makes),
        startingPrice: t.startingPrice,
        rating: t.rating,
        reviewCount: t.reviewCount,
        heroImage: t.hero,
        isVisible: t.sub === "active",
      })
      .returning()
      .get();
    for (const s of t.services) {
      storage.createService({ listingId: listing.id, ...s });
    }
    if (t.sub === "active") {
      storage.upsertSubscription(u.id, "active", periodEnd);
    }
  }

  // Customers
  const cust1 = storage.createUser({
    email: "driver@tunelink.app",
    name: "Sam Okafor",
    role: "customer",
    stripeCustomerId: "cus_mock_seed_1",
    stripeAccountId: null,
    hostSubscriptionStatus: null,
  } as any);
  const cust2 = storage.createUser({
    email: "alex@tunelink.app",
    name: "Alex Rivera",
    role: "customer",
    stripeCustomerId: "cus_mock_seed_2",
    stripeAccountId: null,
    hostSubscriptionStatus: null,
  } as any);

  storage.createVehicle({
    userId: cust1.id,
    year: 2019,
    make: "Chevrolet",
    model: "Camaro SS",
    modifications: "Long-tube headers, cold air intake, 93 octane",
    fuelType: "Pump gas (93)",
  });
  storage.createVehicle({
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
    storage.createReview({
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
  const fee = Math.round(sub * 0.1);
  storage.createBooking({
    customerId: cust1.id,
    tunerId: tunerUserIds[0],
    listingId: 1,
    serviceId: 2,
    vehicleId: 1,
    status: "accepted",
    subtotal: sub,
    serviceFee: fee,
    total: sub + fee,
    insuranceAcknowledged: true,
    paid: true,
    notes: "Looking to refine part-throttle drivability on 93 octane.",
    createdAt: now - 3 * 24 * 60 * 60 * 1000,
  });
}
