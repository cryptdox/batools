-- Migration: 048_ac_hibernate.sql
-- A hibernated topic keeps its cycles, points and rollups but is left off the
-- Kanban. A milestone's switch hibernates / wakes the milestone and its direct
-- children only (grandchildren keep their own setting).
-- Adds one column to ac_topics only.

ALTER TABLE ac_topics
  ADD COLUMN IF NOT EXISTS is_hibernated BOOLEAN NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
