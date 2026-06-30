-- Sections are named after the actual people
CREATE TYPE section_type AS ENUM (
  'morning_shared',
  'morning_rebecca',
  'morning_pz',
  'evening_shared',
  'evening_rebecca',
  'evening_pz',
  'before_bed_discuss',
  'last_to_bed'
);

-- User profiles: links a Supabase auth user to a display name and role
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('rebecca', 'pz')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Master list of checklist items
-- recurrence_rule is JSON:
--   {"type": "daily"}
--   {"type": "weekly", "days": [0,1,2,3,4,5,6]}  (0=Sun, 6=Sat)
--   {"type": "occasional"}
CREATE TABLE checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  section section_type NOT NULL,
  recurrence_rule JSONB NOT NULL DEFAULT '{"type": "daily"}',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tracks which occasional items are turned on for a specific date
CREATE TABLE daily_item_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
  active_on DATE NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(item_id, active_on)
);

-- One row per item per day it was checked off (may have multiple completions
-- if unchecked and re-checked, but only the latest matters)
CREATE TABLE checklist_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
  completed_by UUID NOT NULL REFERENCES auth.users(id),
  completed_on DATE NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(item_id, completed_on)
);

-- Row-level security: all authenticated users can read everything,
-- and write their own completions/overrides
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_item_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_completions ENABLE ROW LEVEL SECURITY;

-- Profiles: each user can read all profiles (so we can show display names),
-- but only write their own
CREATE POLICY "profiles_read_all" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- Checklist items: all authenticated users can read; no client-side inserts
-- (items are managed via the app UI which uses the anon key, so we allow all)
CREATE POLICY "items_read_all" ON checklist_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "items_write_all" ON checklist_items FOR ALL TO authenticated USING (true);

-- Overrides: all authenticated users can read and write
CREATE POLICY "overrides_read_all" ON daily_item_overrides FOR SELECT TO authenticated USING (true);
CREATE POLICY "overrides_write_all" ON daily_item_overrides FOR ALL TO authenticated USING (true);

-- Completions: all authenticated users can read; anyone can insert/delete
-- (either person can uncheck the other's mistake)
CREATE POLICY "completions_read_all" ON checklist_completions FOR SELECT TO authenticated USING (true);
CREATE POLICY "completions_write_all" ON checklist_completions FOR ALL TO authenticated USING (true);

-- Enable realtime on completions and overrides so the iPad updates live
ALTER PUBLICATION supabase_realtime ADD TABLE checklist_completions;
ALTER PUBLICATION supabase_realtime ADD TABLE daily_item_overrides;
