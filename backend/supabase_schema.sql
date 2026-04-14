-- DropoutIQ v4 — Supabase Schema
-- Run this in Supabase SQL editor to update your database.

-- ── Existing table (keep) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS predictions (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id          TEXT,
  student_name        TEXT,
  prediction          TEXT NOT NULL,
  dropout_probability FLOAT NOT NULL,
  risk_level          TEXT NOT NULL,
  intervention_score  FLOAT,
  input_features      JSONB,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE predictions ADD COLUMN IF NOT EXISTS intervention_score FLOAT DEFAULT NULL;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS user_id TEXT;

-- ── New: User Roles ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_roles (
  user_id    TEXT PRIMARY KEY,          -- Clerk sub
  role       TEXT NOT NULL DEFAULT 'advisor', -- 'admin' | 'advisor'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── New: Per-student risk timeline (multi-semester tracking) ─────────────────
CREATE TABLE IF NOT EXISTS risk_timeline (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id          TEXT NOT NULL,
  semester            INT  NOT NULL DEFAULT 1,
  dropout_probability FLOAT NOT NULL,
  risk_level          TEXT NOT NULL,
  prediction_id       UUID,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── New: Active learning labels ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS active_learning_labels (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prediction_id UUID NOT NULL,
  true_label    TEXT NOT NULL,           -- 'Dropout' | 'Graduate'
  labeled_by    TEXT,                    -- Clerk user_id
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── New: Alerts log ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts_log (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id  TEXT,
  student_name TEXT,
  alert_type  TEXT NOT NULL,            -- 'email' | 'slack'
  channel     TEXT,                     -- email address or slack channel
  sent_at     TIMESTAMPTZ DEFAULT NOW(),
  payload     JSONB
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_predictions_dropout_prob  ON predictions (dropout_probability DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_created_at    ON predictions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_risk_level    ON predictions (risk_level);
CREATE INDEX IF NOT EXISTS idx_predictions_student_id    ON predictions (student_id);
CREATE INDEX IF NOT EXISTS idx_predictions_user_id       ON predictions (user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_student_name  ON predictions (student_name);
CREATE INDEX IF NOT EXISTS idx_risk_timeline_student_id  ON risk_timeline (student_id);
CREATE INDEX IF NOT EXISTS idx_active_learning_pred_id   ON active_learning_labels (prediction_id);
