import { writeFileSync, mkdirSync } from 'fs'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const TABLES = [
  'sections',
  'checklist_items',
  'checklist_completions',
  'daily_item_skips',
  'daily_item_overrides',
  'daily_item_text_overrides',
  'profiles',
  'shabbat_sections',
  'shabbat_items',
  'shabbat_completions',
]

mkdirSync('backups', { recursive: true })

for (const table of TABLES) {
  console.log(`Backing up ${table}...`)
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      Accept: 'application/json',
    },
  })
  console.log(`  HTTP ${res.status}`)
  const text = await res.text()
  if (!res.ok) {
    console.error(`  Error: ${text}`)
    process.exit(1)
  }
  writeFileSync(`backups/${table}.json`, JSON.stringify(JSON.parse(text), null, 2))
  console.log(`  ✓ ${JSON.parse(text).length} rows`)
}

console.log(`\nBackup complete: ${new Date().toUTCString()}`)
