-- Migration: 008_team_member_types.sql
-- Team members get a "type" (designation/role label) managed from Settings.
--
-- ON DELETE SET NULL rather than CASCADE or RESTRICT: a type is only a label,
-- so removing one must never delete the people carrying it or their
-- attendance history — those members simply become untyped.

CREATE TABLE team_member_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE team_members
  ADD COLUMN type_id UUID NULL REFERENCES team_member_types(id) ON DELETE SET NULL;

CREATE INDEX idx_team_members_type_id ON team_members(type_id);

ALTER TABLE team_member_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON team_member_types FOR ALL USING (true);
