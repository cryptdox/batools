-- Migration: 001_initial_schema.sql
-- Create Enum for Attendance State
CREATE TYPE attendance_state AS ENUM (
  'NO_ENTRY',
  'ENTRY',
  'LEAVE'
);

-- Team Members Table
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Attendance Records Table
CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES team_members(id),
  attendance_date DATE NOT NULL,
  state attendance_state NOT NULL DEFAULT 'NO_ENTRY',
  entry_time TIMESTAMPTZ NULL,
  threshold_time_used TIME NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_member_id, attendance_date)
);

-- Attendance Settings Table
CREATE TABLE attendance_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  late_threshold TIME NOT NULL,
  punishment_amount NUMERIC(12,2) NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Punishments Table (Snapshot)
CREATE TABLE punishments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES team_members(id),
  attendance_record_id UUID NOT NULL REFERENCES attendance_records(id),
  attendance_date DATE NOT NULL,
  entry_time TIMESTAMPTZ NOT NULL,
  threshold_time_used TIME NOT NULL,
  punishment_amount NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(attendance_record_id)
);

-- Punishment Transactions Table
CREATE TABLE punishment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  punishment_id UUID NOT NULL REFERENCES punishments(id),
  transaction_type TEXT NOT NULL, -- e.g., 'PAID', 'DISCOUNT'
  amount NUMERIC(12,2) NOT NULL,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Basic RLS setup (Example: public for now, tighten later as needed for a fully authenticated app)
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE punishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE punishment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access" ON team_members FOR ALL USING (true);
CREATE POLICY "Allow all access" ON attendance_records FOR ALL USING (true);
CREATE POLICY "Allow all access" ON attendance_settings FOR ALL USING (true);
CREATE POLICY "Allow all access" ON punishments FOR ALL USING (true);
CREATE POLICY "Allow all access" ON punishment_transactions FOR ALL USING (true);

-- Seed Data
INSERT INTO attendance_settings (late_threshold, punishment_amount, effective_from)
VALUES ('10:00:00', 200.00, '2026-09-01 00:00:00+00');

INSERT INTO team_members (name, is_active) VALUES 
  ('Abir Hosen', true),
  ('Tanbir Hossen', true),
  ('Rahim', true),
  ('Karim', true);
