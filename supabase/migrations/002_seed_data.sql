-- Sample items to get started — edit or delete these as you like
-- sort_order controls position within a section (lower = higher up)

INSERT INTO checklist_items (text, section, recurrence_rule, sort_order) VALUES
  -- Morning shared
  ('Start coffee', 'morning_shared', '{"type":"daily"}', 10),
  ('Pack lunches', 'morning_shared', '{"type":"weekly","days":[1,2,3,4,5]}', 20),
  ('Check calendar for today', 'morning_shared', '{"type":"daily"}', 30),

  -- Rebecca morning
  ('Take vitamins', 'morning_rebecca', '{"type":"daily"}', 10),
  ('Charge phone before leaving', 'morning_rebecca', '{"type":"daily"}', 20),

  -- PZ morning
  ('Take vitamins', 'morning_pz', '{"type":"daily"}', 10),
  ('Water plants', 'morning_pz', '{"type":"weekly","days":[1,4]}', 20),

  -- Evening shared
  ('Start dishwasher', 'evening_shared', '{"type":"daily"}', 10),
  ('Wipe down kitchen counters', 'evening_shared', '{"type":"daily"}', 20),
  ('Check tomorrow''s calendar', 'evening_shared', '{"type":"daily"}', 30),

  -- Rebecca evening
  ('Set out tomorrow''s clothes', 'evening_rebecca', '{"type":"daily"}', 10),

  -- PZ evening
  ('Walk dog', 'evening_pz', '{"type":"daily"}', 10),

  -- Before bed discuss
  ('Any decisions to make for tomorrow?', 'before_bed_discuss', '{"type":"daily"}', 10),
  ('Anything one of us needs from the other this week?', 'before_bed_discuss', '{"type":"daily"}', 20),

  -- Last to bed
  ('Lock front door', 'last_to_bed', '{"type":"daily"}', 10),
  ('Turn off all lights', 'last_to_bed', '{"type":"daily"}', 20),
  ('Make sure stove is off', 'last_to_bed', '{"type":"daily"}', 30),
  ('Plug in devices to charge', 'last_to_bed', '{"type":"daily"}', 40),

  -- Occasional examples
  ('Bring water bottle to daycare', 'morning_shared', '{"type":"occasional"}', 100),
  ('Put out trash bins', 'last_to_bed', '{"type":"occasional"}', 100),
  ('Meal prep for the week', 'morning_shared', '{"type":"occasional"}', 110);
