/**
 * Stripe integration for TunersAmerica.
 *
 *  - Buyer Pass: $10 one-time → 30-day directory access (price_..._PASS)
 *  - Tuner Subscription: $99 / year recurring (price_..._SUB)
 *
 * Set STRIPE_SECRET_KEY in env to enable live charging.
 * Without it, the server falls back to demoMode stubs.
 */
import Stripe from "stripe";

const SECRET = process.env.STRIPE_SECRET_KEY;
const PUBLISHABLE = process.env.STRIPE_PUBLISHABLE_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Default to the live price IDs created in the Rents America Stripe account
// (acct_1TgR83RgVosLc3T2) on 2026-06-12. Overridable via env.
export const BUYER_PASS_PRICE_ID =
  process.env.STRIPE_BUYER_PASS_PRICE_ID || "price_1Thcp8RgVosLc3T2hxlydSp0";
export const TUNER_SUB_PRICE_ID =
  process.env.STRIPE_TUNER_SUB_PRICE_ID || "price_1Thcp8RgVosLc3T27SIdThnT";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!SECRET) return null;
  if (!_stripe) {
    _stripe = new Stripe(SECRET, { apiVersion: "2025-05-28.basil" as any });
  }
  return _stripe;
}

export function stripeEnabled(): boolean {
  return !!SECRET;
}

export function publishableKey(): string | null {
  return PUBLISHABLE || null;
}

export function webhookSecret(): string | null {
  return WEBHOOK_SECRET || null;
}

export function siteUrl(): string {
  return process.env.PUBLIC_URL || "https://tunersamerica.com";
}
