import {
  pgTable,
  serial,
  text,
  integer,
  bigint,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/* ---------------- Users ---------------- */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull(), // 'tuner' | 'customer' | 'admin'
  token: text("token").notNull(), // session token (returned on login/register)
  passwordHash: text("password_hash"), // bcrypt; null means user pre-dates password auth
  emailVerified: boolean("email_verified").notNull().default(false),
  emailVerifyToken: text("email_verify_token"), // one-time token sent in verification email
  passwordResetToken: text("password_reset_token"),
  passwordResetExpiresAt: bigint("password_reset_expires_at", { mode: "number" }),
  stripeCustomerId: text("stripe_customer_id"),
  stripeAccountId: text("stripe_account_id"), // tuners only
  hostSubscriptionStatus: text("host_subscription_status"), // 'active' | 'inactive' | 'past_due'
  // $10 / 30-day buyer access pass. Epoch ms of expiration; null = never purchased.
  passExpiresAt: bigint("pass_expires_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  token: true,
  createdAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

/* ---------------- Tuner Listings ---------------- */
export const tunerListings = pgTable("tuner_listings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  shopName: text("shop_name").notNull(),
  location: text("location").notNull(),
  bio: text("bio").notNull(),
  dynoAvailable: boolean("dyno_available").notNull().default(false),
  remoteAvailable: boolean("remote_available").notNull().default(false),
  supportedMakes: jsonb("supported_makes").notNull().$type<string[]>().default([]),
  startingPrice: integer("starting_price").notNull(),
  rating: integer("rating").notNull().default(50), // stored x10 (e.g. 48 = 4.8)
  reviewCount: integer("review_count").notNull().default(0),
  heroImage: text("hero_image"),
  isVisible: boolean("is_visible").notNull().default(false),
});

export const insertListingSchema = createInsertSchema(tunerListings).omit({
  id: true,
  rating: true,
  reviewCount: true,
  isVisible: true,
});
export type InsertListing = z.infer<typeof insertListingSchema>;
export type TunerListing = typeof tunerListings.$inferSelect;

/* ---------------- Services (legacy — kept for booking backwards-compat) ---------------- */
export const serviceCategories = [
  "remote",
  "dyno",
  "diagnostics",
  "ecu",
  "tcm",
  "build_support",
  "race_setup",
] as const;

export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  listingId: integer("listing_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(),
  category: text("category").notNull(),
});

export const insertServiceSchema = createInsertSchema(services).omit({ id: true });
export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof services.$inferSelect;

/* ---------------- Capabilities (6 groups) ---------------- */
export const capabilityGroups = [
  "tuning_type",
  "engine",
  "ecu",
  "fuel",
  "induction",
  "application",
] as const;
export type CapabilityGroup = (typeof capabilityGroups)[number];

export const TUNING_TYPES = ["dyno", "street", "track", "remote"] as const;
export const ENGINES = [
  "LS", "LT", "SBF", "BBC", "BBF", "2JZ", "SR20",
  "Duramax", "Cummins", "Hemi", "Coyote", "Mod Motor", "K-Series",
] as const;
export const ECUS = [
  "OEM", "Holley EFI", "FuelTech", "Haltech", "MegaSquirt",
  "Speeduino", "MoTeC", "Bosch", "Hondata",
] as const;
export const FUELS = ["Pump gas", "E85", "Methanol"] as const;
export const INDUCTION = ["Turbo", "Supercharger", "NA", "Nitrous"] as const;
export const APPLICATIONS = ["Drag", "Drift", "Cruiser", "Road race", "Top speed"] as const;

export const tunerCapabilities = pgTable("tuner_capabilities", {
  id: serial("id").primaryKey(),
  listingId: integer("listing_id").notNull(),
  groupName: text("group_name").notNull(), // capabilityGroups value
  value: text("value").notNull(),           // e.g. "dyno", "LS", "Holley EFI"
  price: integer("price"),                  // only set for tuning_type rows (starting $)
});

export type TunerCapability = typeof tunerCapabilities.$inferSelect;
export type InsertCapability = Omit<TunerCapability, "id">;

/* ---------------- Vehicles ---------------- */
export const vehicles = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  year: integer("year").notNull(),
  make: text("make").notNull(),
  model: text("model").notNull(),
  modifications: text("modifications").notNull().default(""),
  fuelType: text("fuel_type").notNull().default("Pump gas"),
});

export const insertVehicleSchema = createInsertSchema(vehicles).omit({ id: true });
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Vehicle = typeof vehicles.$inferSelect;

/* ---------------- Bookings ---------------- */
export const bookingStatuses = [
  "requested",
  "accepted",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  tunerId: integer("tuner_id").notNull(),
  listingId: integer("listing_id").notNull(),
  serviceId: integer("service_id"),
  vehicleId: integer("vehicle_id").notNull(),
  status: text("status").notNull().default("requested"),
  subtotal: integer("subtotal").notNull(),
  serviceFee: integer("service_fee").notNull(),
  total: integer("total").notNull(),
  insuranceAcknowledged: boolean("insurance_acknowledged").notNull().default(false),
  paid: boolean("paid").notNull().default(false),
  notes: text("notes").notNull().default(""),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

// Client submits this shape; server computes fees + total.
export const createBookingSchema = z.object({
  customerId: z.number(),
  listingId: z.number(),
  serviceId: z.number().nullable().optional(),
  vehicleId: z.number(),
  subtotal: z.number().min(1),
  insuranceAcknowledged: z.literal(true, {
    errorMap: () => ({ message: "Insurance acknowledgment is required" }),
  }),
  notes: z.string().optional(),
});
export type CreateBooking = z.infer<typeof createBookingSchema>;
export type Booking = typeof bookings.$inferSelect;

/* ---------------- Reviews (two-way, booking-gated) ---------------- */
// direction = 'customer_to_tuner' (legacy: listing-targeted) OR 'tuner_to_customer'
export const reviewDirections = ["customer_to_tuner", "tuner_to_customer"] as const;
export type ReviewDirection = (typeof reviewDirections)[number];

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id"),
  // Legacy: customer leaving a review on a tuner listing.
  customerId: integer("customer_id").notNull(),
  listingId: integer("listing_id").notNull(),
  // New (nullable for legacy rows):
  authorUserId: integer("author_user_id"),   // who wrote the review
  revieweeUserId: integer("reviewee_user_id"), // who is being reviewed
  direction: text("direction"),                 // reviewDirections value
  rating: integer("rating").notNull(),
  comment: text("comment").notNull(),
  authorName: text("author_name").notNull().default("Customer"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
  createdAt: true,
});
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviews.$inferSelect;

// Client-submitted review (booking-gated). Server resolves direction + identities.
export const createReviewSchema = z.object({
  bookingId: z.number(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(2000),
});
export type CreateReview = z.infer<typeof createReviewSchema>;

/* ---------------- Subscriptions ---------------- */
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  status: text("status").notNull(), // 'active' | 'inactive' | 'past_due'
  currentPeriodEnd: bigint("current_period_end", { mode: "number" }),
  stripeSubscriptionId: text("stripe_subscription_id"),
});
export type Subscription = typeof subscriptions.$inferSelect;

/* ---------------- Promo codes ---------------- */
export const promoCodes = pgTable("promo_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(), // case-insensitive on lookup
  // Buyer side: grant a free pass of this many days (0 = disabled for buyers)
  buyerPassDays: integer("buyer_pass_days").notNull().default(0),
  buyerMaxRedemptions: integer("buyer_max_redemptions").notNull().default(0),
  buyerRedemptions: integer("buyer_redemptions").notNull().default(0),
  // Tuner side: grant this many free trial days on the $99/yr subscription (0 = disabled for tuners)
  tunerTrialDays: integer("tuner_trial_days").notNull().default(0),
  tunerMaxRedemptions: integer("tuner_max_redemptions").notNull().default(0),
  tunerRedemptions: integer("tuner_redemptions").notNull().default(0),
  // Restrictions
  firstTimeOnly: boolean("first_time_only").notNull().default(true),
  expiresAt: bigint("expires_at", { mode: "number" }), // epoch ms; null = never
  active: boolean("active").notNull().default(true),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type PromoCode = typeof promoCodes.$inferSelect;

export const promoRedemptions = pgTable("promo_redemptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  promoCodeId: integer("promo_code_id").notNull(),
  role: text("role").notNull(), // 'buyer' | 'tuner'
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type PromoRedemption = typeof promoRedemptions.$inferSelect;

/* ---------------- Derived view types ---------------- */
export type ListingWithDetails = TunerListing & {
  services: Service[];
  reviews: Review[];
  capabilities: TunerCapability[];
  tunerName: string;
};

export type DriverProfile = {
  id: number;
  name: string;
  vehicles: Vehicle[];
  reviews: Review[];
  rating: number;       // average x10 (e.g. 48 = 4.8); 0 if no reviews
  reviewCount: number;
};
