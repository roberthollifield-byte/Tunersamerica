import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/* ---------------- Users ---------------- */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull(), // 'tuner' | 'customer' | 'admin'
  token: text("token").notNull(), // magic-link session token
  stripeCustomerId: text("stripe_customer_id"),
  stripeAccountId: text("stripe_account_id"), // tuners only
  hostSubscriptionStatus: text("host_subscription_status"), // 'active' | 'inactive' | 'past_due'
  createdAt: integer("created_at").notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  token: true,
  createdAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

/* ---------------- Tuner Listings ---------------- */
export const tunerListings = sqliteTable("tuner_listings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  shopName: text("shop_name").notNull(),
  location: text("location").notNull(),
  bio: text("bio").notNull(),
  dynoAvailable: integer("dyno_available", { mode: "boolean" }).notNull().default(false),
  remoteAvailable: integer("remote_available", { mode: "boolean" }).notNull().default(false),
  supportedMakes: text("supported_makes").notNull(), // JSON text array
  startingPrice: integer("starting_price").notNull(),
  rating: integer("rating").notNull().default(50), // stored x10 (e.g. 48 = 4.8)
  reviewCount: integer("review_count").notNull().default(0),
  heroImage: text("hero_image"),
  isVisible: integer("is_visible", { mode: "boolean" }).notNull().default(false),
});

export const insertListingSchema = createInsertSchema(tunerListings).omit({
  id: true,
  rating: true,
  reviewCount: true,
  isVisible: true,
});
export type InsertListing = z.infer<typeof insertListingSchema>;
export type TunerListing = typeof tunerListings.$inferSelect;

/* ---------------- Services ---------------- */
export const serviceCategories = [
  "remote",
  "dyno",
  "diagnostics",
  "ecu",
  "tcm",
  "build_support",
  "race_setup",
] as const;

export const services = sqliteTable("services", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  listingId: integer("listing_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(),
  category: text("category").notNull(),
});

export const insertServiceSchema = createInsertSchema(services).omit({ id: true });
export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof services.$inferSelect;

/* ---------------- Vehicles ---------------- */
export const vehicles = sqliteTable("vehicles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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

export const bookings = sqliteTable("bookings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerId: integer("customer_id").notNull(),
  tunerId: integer("tuner_id").notNull(),
  listingId: integer("listing_id").notNull(),
  serviceId: integer("service_id"),
  vehicleId: integer("vehicle_id").notNull(),
  status: text("status").notNull().default("requested"),
  subtotal: integer("subtotal").notNull(),
  serviceFee: integer("service_fee").notNull(),
  total: integer("total").notNull(),
  insuranceAcknowledged: integer("insurance_acknowledged", { mode: "boolean" }).notNull().default(false),
  paid: integer("paid", { mode: "boolean" }).notNull().default(false),
  notes: text("notes").notNull().default(""),
  createdAt: integer("created_at").notNull(),
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

/* ---------------- Reviews ---------------- */
export const reviews = sqliteTable("reviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bookingId: integer("booking_id"),
  customerId: integer("customer_id").notNull(),
  listingId: integer("listing_id").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment").notNull(),
  authorName: text("author_name").notNull().default("Customer"),
  createdAt: integer("created_at").notNull(),
});

export const insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
  createdAt: true,
});
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviews.$inferSelect;

/* ---------------- Subscriptions ---------------- */
export const subscriptions = sqliteTable("subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  status: text("status").notNull(), // 'active' | 'inactive' | 'past_due'
  currentPeriodEnd: integer("current_period_end"),
  stripeSubscriptionId: text("stripe_subscription_id"),
});
export type Subscription = typeof subscriptions.$inferSelect;

/* ---------------- Derived view types ---------------- */
export type ListingWithDetails = TunerListing & {
  services: Service[];
  reviews: Review[];
  tunerName: string;
};
