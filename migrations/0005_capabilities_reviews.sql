-- Capabilities (5 groups: tuning_type, engine, ecu, fuel, induction)
CREATE TABLE IF NOT EXISTS tuner_capabilities (
  id          serial PRIMARY KEY,
  listing_id  integer NOT NULL,
  group_name  text    NOT NULL,
  value       text    NOT NULL,
  price       integer
);

CREATE INDEX IF NOT EXISTS tuner_capabilities_listing_idx ON tuner_capabilities (listing_id);
CREATE INDEX IF NOT EXISTS tuner_capabilities_group_value_idx ON tuner_capabilities (group_name, value);

-- Two-way reviews
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS author_user_id   integer;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS reviewee_user_id integer;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS direction        text;

CREATE INDEX IF NOT EXISTS reviews_reviewee_idx ON reviews (reviewee_user_id);
CREATE INDEX IF NOT EXISTS reviews_booking_direction_idx ON reviews (booking_id, direction);

-- Backfill: legacy rows are customer-to-tuner
UPDATE reviews
   SET direction = 'customer_to_tuner',
       author_user_id = customer_id
 WHERE direction IS NULL;
