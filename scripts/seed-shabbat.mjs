// Seeds Shabbat sections and items into the dev database.
// Run with: node scripts/seed-shabbat.mjs
// To target prod instead: change URL/KEY to prod values.

import { createClient } from '@supabase/supabase-js'

const URL = 'https://qackkxtgslutyidmfjdw.supabase.co'
const KEY = 'sb_publishable_fl32tAGXTPepJ6vUM8PcPg_asOjj1fm'
const supabase = createClient(URL, KEY)

const SECTIONS = [
  { id: 'shabbat_cooking',  label: 'Shabbat: Cooking',               sort_order: 200, tags: ['shabbat'] },
  { id: 'shabbat_errands',  label: 'Shabbat: Errands',               sort_order: 210, tags: ['shabbat'] },
  { id: 'shabbat_cleaning', label: 'Shabbat: Cleaning',              sort_order: 220, tags: ['shabbat'] },
  { id: 'shabbat_before',   label: 'Shabbat: Shortly Before',        sort_order: 230, tags: ['shabbat'] },
  { id: 'shabbat_misc',     label: 'Shabbat: Miscellaneous',         sort_order: 240, tags: ['shabbat'] },
  { id: 'shabbat_chag',     label: 'Shabbat: Chag',                  sort_order: 250, tags: ['shabbat'] },
  { id: 'shabbat_after',    label: 'Shabbat: After Shabbat',         sort_order: 260, tags: ['shabbat'] },
  { id: 'shabbat_meals',    label: 'Shabbat: Meal Arrangements',     sort_order: 270, tags: ['shabbat'] },
]

const ITEMS = [
  // Cooking
  { text: 'Heat soup',              section: 'shabbat_cooking', sort_order: 10 },
  { text: 'Microwave sweet potato', section: 'shabbat_cooking', sort_order: 20 },
  { text: 'Defrost pitot',          section: 'shabbat_cooking', sort_order: 30 },

  // Errands
  { text: 'Challah',                    section: 'shabbat_errands', sort_order: 10 },
  { text: 'Take stroller out of car',   section: 'shabbat_errands', sort_order: 20 },

  // Cleaning
  { text: 'Tidy tables',                          section: 'shabbat_cleaning', sort_order: 10 },
  { text: 'Clean floors',                         section: 'shabbat_cleaning', sort_order: 20 },
  { text: 'Tidy kitchen',                         section: 'shabbat_cleaning', sort_order: 30 },
  { text: 'Clean kitchen counters',               section: 'shabbat_cleaning', sort_order: 40 },
  { text: 'Put away laundry',                     section: 'shabbat_cleaning', sort_order: 50 },
  { text: 'Vacuum cooking areas',                 section: 'shabbat_cleaning', sort_order: 60 },
  { text: 'Empty washing machine / close valve',  section: 'shabbat_cleaning', sort_order: 70 },
  { text: 'Empty bedroom garbage',                section: 'shabbat_cleaning', sort_order: 80 },
  { text: 'Window, fan, light, A/C, Shabbat lamp — check each room:', section: 'shabbat_cleaning', sort_order: 90 },
  { text: 'Living room',      section: 'shabbat_cleaning', sort_order: 100 },
  { text: 'Master bedroom',   section: 'shabbat_cleaning', sort_order: 110 },
  { text: 'Master bathroom',  section: 'shabbat_cleaning', sort_order: 120 },
  { text: 'Main bathroom',    section: 'shabbat_cleaning', sort_order: 130 },
  { text: 'Guest room',       section: 'shabbat_cleaning', sort_order: 140 },
  { text: "Hadas's room",     section: 'shabbat_cleaning', sort_order: 150 },
  { text: 'Mamad',            section: 'shabbat_cleaning', sort_order: 160 },

  // Shortly Before Shabbat
  { text: 'Take out garbage',                                 section: 'shabbat_before', sort_order: 10 },
  { text: 'Plata (make sure on timer)',                       section: 'shabbat_before', sort_order: 20 },
  { text: 'Talk to family',                                   section: 'shabbat_before', sort_order: 30 },
  { text: 'Turn off oven',                                    section: 'shabbat_before', sort_order: 40 },
  { text: 'Fan',                                              section: 'shabbat_before', sort_order: 50 },
  { text: 'Sterilize and fill bottles',                       section: 'shabbat_before', sort_order: 60 },
  { text: 'Prep water for formula',                           section: 'shabbat_before', sort_order: 70 },
  { text: 'Empty dryer',                                      section: 'shabbat_before', sort_order: 80 },
  { text: 'Clean cast iron pan',                              section: 'shabbat_before', sort_order: 90 },
  { text: 'Clear couch of electronics and electronics corner',section: 'shabbat_before', sort_order: 100 },
  { text: 'Turn on hearing aids',                             section: 'shabbat_before', sort_order: 110 },
  { text: 'Dryer door',                                       section: 'shabbat_before', sort_order: 120 },
  { text: 'Stop timers',                                      section: 'shabbat_before', sort_order: 130 },
  { text: 'Empty microwave',                                  section: 'shabbat_before', sort_order: 140 },
  { text: 'Unplug microwave',                                 section: 'shabbat_before', sort_order: 150 },
  { text: "Restock Hadas's backpack",                         section: 'shabbat_before', sort_order: 160 },

  // Miscellaneous
  { text: 'Remove muktza stuff from door',                    section: 'shabbat_misc', sort_order: 10 },
  { text: 'Prep ORS',                                         section: 'shabbat_misc', sort_order: 20 },
  { text: 'Prep ORS dry portions',                            section: 'shabbat_misc', sort_order: 30 },
  { text: 'Confirm meal times',                               section: 'shabbat_misc', sort_order: 40 },
  { text: 'Turn off toys',                                    section: 'shabbat_misc', sort_order: 50 },
  { text: 'Take fan off carry stroller',                      section: 'shabbat_misc', sort_order: 60 },
  { text: 'Open wipes, diapers, formula; rip garbage bags, rip diaper garbage bags', section: 'shabbat_misc', sort_order: 70 },
  { text: 'Upload recent photos',                             section: 'shabbat_misc', sort_order: 80 },
  { text: 'Air conditioning',                                 section: 'shabbat_misc', sort_order: 90 },
  { text: 'Fridge light',                                     section: 'shabbat_misc', sort_order: 100 },
  { text: 'Shabbat lamp',                                     section: 'shabbat_misc', sort_order: 110 },
  { text: 'Lights',                                           section: 'shabbat_misc', sort_order: 120 },
  { text: 'Aluminum foil',                                    section: 'shabbat_misc', sort_order: 130 },
  { text: 'Paper towels',                                     section: 'shabbat_misc', sort_order: 140 },
  { text: 'Tissues in bathroom',                              section: 'shabbat_misc', sort_order: 150 },
  { text: 'Shower',                                           section: 'shabbat_misc', sort_order: 160 },
  { text: 'Bathe Hadas',                                      section: 'shabbat_misc', sort_order: 170 },
  { text: 'Mincha',                                           section: 'shabbat_misc', sort_order: 180 },
  { text: 'PZ shave',                                         section: 'shabbat_misc', sort_order: 190 },
  { text: 'Wind watch',                                       section: 'shabbat_misc', sort_order: 200 },
  { text: 'Write down Shabbat times',                         section: 'shabbat_misc', sort_order: 210 },
  { text: 'Candles setup',                                    section: 'shabbat_misc', sort_order: 220 },
  { text: 'Set hearing aid charger and timer',                section: 'shabbat_misc', sort_order: 230 },
  { text: 'Turn off boiler',                                  section: 'shabbat_misc', sort_order: 240 },
  { text: 'Set alarm',                                        section: 'shabbat_misc', sort_order: 250 },
  { text: 'Meds on pillow',                                   section: 'shabbat_misc', sort_order: 260 },
  { text: 'Sefirat haomer count on pillow',                   section: 'shabbat_misc', sort_order: 270 },
  { text: 'Get out matches',                                  section: 'shabbat_misc', sort_order: 280 },
  { text: 'Write down address',                               section: 'shabbat_misc', sort_order: 290 },
  { text: 'Rebecca — workout',                                section: 'shabbat_misc', sort_order: 300 },
  { text: 'Shake Vanilla',                                    section: 'shabbat_misc', sort_order: 310 },
  { text: 'Daily + weekly tallies',                           section: 'shabbat_misc', sort_order: 320 },
  { text: "Open containers that can't be opened on Shabbat",  section: 'shabbat_misc', sort_order: 330 },
  { text: 'Turn on baby monitor',                             section: 'shabbat_misc', sort_order: 340 },
  { text: 'Separate keys',                                    section: 'shabbat_misc', sort_order: 350 },
  { text: 'Defrost food for motzash',                         section: 'shabbat_misc', sort_order: 360 },
  { text: 'Grind coffee',                                     section: 'shabbat_misc', sort_order: 370 },
  { text: 'Vitamin D on formula',                             section: 'shabbat_misc', sort_order: 380 },

  // Chag
  { text: 'Eruv tavshilin',          section: 'shabbat_chag', sort_order: 10 },
  { text: 'Prep lulav and etrog',    section: 'shabbat_chag', sort_order: 20 },
  { text: '48 hour candle',          section: 'shabbat_chag', sort_order: 30 },
  { text: 'Turn off weekday alarms', section: 'shabbat_chag', sort_order: 40 },

  // After Shabbat
  { text: "Make tonight's checklist",          section: 'shabbat_after', sort_order: 10 },
  { text: 'Shabbat lamp',                      section: 'shabbat_after', sort_order: 20 },
  { text: 'Fridge light',                      section: 'shabbat_after', sort_order: 30 },
  { text: 'Plata',                             section: 'shabbat_after', sort_order: 40 },
  { text: 'Air conditioning timers',           section: 'shabbat_after', sort_order: 50 },
  { text: 'Kettle',                            section: 'shabbat_after', sort_order: 60 },
  { text: 'Set boiler timer',                  section: 'shabbat_after', sort_order: 70 },
  { text: 'Alarms',                            section: 'shabbat_after', sort_order: 80 },
  { text: 'Fan off',                           section: 'shabbat_after', sort_order: 90 },
  { text: 'Erase Shabbat times',              section: 'shabbat_after', sort_order: 100 },
  { text: 'Decide who to arrange meals with',  section: 'shabbat_after', sort_order: 110 },
  { text: 'New Date Night Selection',          section: 'shabbat_after', sort_order: 120 },
  { text: 'Discuss Dani schedule',             section: 'shabbat_after', sort_order: 130 },
  { text: 'Add challah to shopping list',      section: 'shabbat_after', sort_order: 140 },
  { text: 'If post chag: reset weekday alarms',section: 'shabbat_after', sort_order: 150 },
  { text: 'Retrieve stroller',                 section: 'shabbat_after', sort_order: 160 },

  // Meal Arrangements
  { text: 'Bergfeld',         section: 'shabbat_meals', sort_order: 10 },
  { text: 'Berger',           section: 'shabbat_meals', sort_order: 20 },
  { text: 'Nehrer',           section: 'shabbat_meals', sort_order: 30 },
  { text: 'Eckstein',         section: 'shabbat_meals', sort_order: 40 },
  { text: 'Rosenberg',        section: 'shabbat_meals', sort_order: 50 },
  { text: 'Eli and Noa',      section: 'shabbat_meals', sort_order: 60 },
  { text: 'Betzalel and Liora',section: 'shabbat_meals', sort_order: 70 },
  { text: 'Sabba and Savta',  section: 'shabbat_meals', sort_order: 80 },
  { text: 'Netanel and Nissana', section: 'shabbat_meals', sort_order: 90 },
  { text: 'Fish',             section: 'shabbat_meals', sort_order: 100 },
  { text: 'Amalya and Benjy', section: 'shabbat_meals', sort_order: 110 },
  { text: 'Tali and Nirel',   section: 'shabbat_meals', sort_order: 120 },
  { text: 'Tova and Benny',   section: 'shabbat_meals', sort_order: 130 },
]

async function main() {
  console.log('Inserting Shabbat sections…')
  const { error: secErr } = await supabase.from('sections').upsert(SECTIONS, { onConflict: 'id' })
  if (secErr) { console.error('Sections error:', secErr.message); process.exit(1) }
  console.log(`  ${SECTIONS.length} sections done.`)

  console.log('Inserting Shabbat items…')
  const itemRows = ITEMS.map(i => ({
    ...i,
    recurrence_rule: { type: 'daily' },
    active: true,
  }))
  const { error: itemErr } = await supabase.from('checklist_items').insert(itemRows)
  if (itemErr) { console.error('Items error:', itemErr.message); process.exit(1) }
  console.log(`  ${ITEMS.length} items done.`)

  console.log('\nAll done. Tag sections with "shabbat" and add "shabbat" to your Friday day_schedule to see them.')
}

main()
