-- Occasionals redesign (Nov 2026). Run once in the Supabase SQL editor.
-- No schema changes: new item kinds live in checklist_items.recurrence_rule (see src/lib/recurrence.js).

-- 1. Standup items: keep them Tracked, flag them for the bi-weekly standup, and give them a
--    real home section so they land somewhere sensible when added to a day.
UPDATE checklist_items
SET recurrence_rule = recurrence_rule || '{"standup": true}'::jsonb,
    section = 'morning_shared'
WHERE active
  AND section = 'ongoing_tracked_in_standup'
  AND recurrence_rule->>'type' = 'occasional';

-- 2. One-off items that lost their date (an old Template-editor bug) never showed up anywhere.
--    Turn them into Tracked items so they're visible again and can be added to a day.
UPDATE checklist_items
SET recurrence_rule = '{"type": "occasional"}'::jsonb
WHERE active
  AND recurrence_rule->>'type' = 'once'
  AND (recurrence_rule->>'date') IS NULL;
