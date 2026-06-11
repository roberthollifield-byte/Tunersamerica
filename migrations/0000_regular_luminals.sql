CREATE TABLE "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"tuner_id" integer NOT NULL,
	"listing_id" integer NOT NULL,
	"service_id" integer,
	"vehicle_id" integer NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"subtotal" integer NOT NULL,
	"service_fee" integer NOT NULL,
	"total" integer NOT NULL,
	"insurance_acknowledged" boolean DEFAULT false NOT NULL,
	"paid" boolean DEFAULT false NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer,
	"customer_id" integer NOT NULL,
	"listing_id" integer NOT NULL,
	"rating" integer NOT NULL,
	"comment" text NOT NULL,
	"author_name" text DEFAULT 'Customer' NOT NULL,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" serial PRIMARY KEY NOT NULL,
	"listing_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"price" integer NOT NULL,
	"category" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"status" text NOT NULL,
	"current_period_end" integer,
	"stripe_subscription_id" text
);
--> statement-breakpoint
CREATE TABLE "tuner_listings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"shop_name" text NOT NULL,
	"location" text NOT NULL,
	"bio" text NOT NULL,
	"dyno_available" boolean DEFAULT false NOT NULL,
	"remote_available" boolean DEFAULT false NOT NULL,
	"supported_makes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"starting_price" integer NOT NULL,
	"rating" integer DEFAULT 50 NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"hero_image" text,
	"is_visible" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"token" text NOT NULL,
	"stripe_customer_id" text,
	"stripe_account_id" text,
	"host_subscription_status" text,
	"created_at" integer NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"year" integer NOT NULL,
	"make" text NOT NULL,
	"model" text NOT NULL,
	"modifications" text DEFAULT '' NOT NULL,
	"fuel_type" text DEFAULT 'Pump gas' NOT NULL
);
