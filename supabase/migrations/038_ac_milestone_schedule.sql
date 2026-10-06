-- Migration: 038_ac_milestone_schedule.sql
-- A milestone can be scheduled on weekdays (every week) and / or on specific
-- dates; the Kanban's "show by day" shows the work of the milestones
-- scheduled for the chosen day. Several milestones can share a day.
-- Adds two columns to ac_topics only.

ALTER TABLE ac_topics
  -- 0 = Sunday … 6 = Saturday.
  ADD COLUMN IF NOT EXISTS schedule_weekdays SMALLINT[] NOT NULL DEFAULT '{}'
    CHECK (schedule_weekdays <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::SMALLINT[]),
  ADD COLUMN IF NOT EXISTS schedule_dates DATE[] NOT NULL DEFAULT '{}';

NOTIFY pgrst, 'reload schema';
