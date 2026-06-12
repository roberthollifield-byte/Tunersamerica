-- Promo code system (app-side, not Stripe-managed)
CREATE TABLE IF NOT EXISTS promo_codes (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  buyer_pass_days integer NOT NULL DEFAULT 0,
  buyer_max_redemptions integer NOT NULL DEFAULT 0,
  buyer_redemptions integer NOT NULL DEFAULT 0,
  tuner_trial_days integer NOT NULL DEFAULT 0,
  tuner_max_redemptions integer NOT NULL DEFAULT 0,
  tuner_redemptions integer NOT NULL DEFAULT 0,
  first_time_only boolean NOT NULL DEFAULT true,
  expires_at bigint,
  active boolean NOT NULL DEFAULT true,
  created_at bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS promo_redemptions (
  id serial PRIMARY KEY,
  user_id integer NOT NULL,
  promo_code_id integer NOT NULL,
  role text NOT NULL,
  created_at bigint NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS promo_redemptions_user_code_role_uniq
  ON promo_redemptions (user_id, promo_code_id, role);

-- Seed the FOUNDERS code:
--   * 30 free days for buyers (50 redemptions cap)
--   * 90 free days for tuners (50 redemptions cap)
--   * First-time customers only
--   * Expires 2026-08-11 03:11:00 UTC  (epoch 1786465860)
INSERT INTO promo_codes (
  code,
  buyer_pass_days, buyer_max_redemptions,
  tuner_trial_days, tuner_max_redemptions,
  first_time_only, expires_at, active, created_at
) VALUES (
  'FOUNDERS',
  30, 50,
  90, 50,
  true, 1786465860000, true,
  CAST(EXTRACT(EPOCH FROM NOW()) * 1000 AS bigint)
)
ON CONFLICT (code) DO NOTHING;
