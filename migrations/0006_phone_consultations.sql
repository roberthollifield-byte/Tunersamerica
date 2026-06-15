-- Phone consultations: $125 / 1-hour driver-to-tuner phone call.
CREATE TABLE IF NOT EXISTS phone_consultations (
  id              serial PRIMARY KEY,
  driver_id       integer NOT NULL,
  tuner_id        integer NOT NULL,
  status          text    NOT NULL DEFAULT 'requested',
  driver_phone    text    NOT NULL,
  tuner_phone     text,
  topic           text    NOT NULL DEFAULT '',
  preferred_time  text    NOT NULL DEFAULT '',
  scheduled_at    text,
  price_cents     integer NOT NULL DEFAULT 12500,
  created_at      bigint  NOT NULL,
  updated_at      bigint  NOT NULL
);

CREATE INDEX IF NOT EXISTS phone_consultations_driver_idx ON phone_consultations(driver_id);
CREATE INDEX IF NOT EXISTS phone_consultations_tuner_idx  ON phone_consultations(tuner_id);
CREATE INDEX IF NOT EXISTS phone_consultations_status_idx ON phone_consultations(status);
