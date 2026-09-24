// Copies sections, checklist_items, and day_schedule from prod to dev.
// Skips completions, overrides, and profiles (user/date-specific).
// Run with: node scripts/copy-prod-to-dev.mjs

import { createClient } from '@supabase/supabase-js'

const PROD_URL = 'https://daabixyswgwcljmgmqqa.supabase.co'
const PROD_KEY = 'sb_publishable_VkOyI9IQnrPcgmZJP0bPdQ_Zi9DlO5A'

const DEV_URL = 'https://qackkxtgslutyidmfjdw.supabase.co'
const DEV_KEY = 'sb_publishable_fl32tAGXTPepJ6vUM8PcPg_asOjj1fm'

const prod = createClient(PROD_URL, PROD_KEY)
const dev = createClient(DEV_URL, DEV_KEY)

async function copyTable(tableName, orderBy = 'sort_order') {
  console.log(`\nCopying ${tableName}...`)
  const { data, error } = await prod.from(tableName).select('*').order(orderBy)
  if (error) { console.error(`  Error reading from prod:`, error.message); return }
  if (!data.length) { console.log(`  No rows found.`); return }

  const { error: delError } = await dev.from(tableName).delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (delError) console.warn(`  Warning clearing dev ${tableName}:`, delError.message)

  const { error: insertError } = await dev.from(tableName).insert(data)
  if (insertError) console.error(`  Error inserting into dev:`, insertError.message)
  else console.log(`  Copied ${data.length} rows.`)
}

async function copyDaySchedule() {
  console.log(`\nCopying day_schedule...`)
  const { data, error } = await prod.from('day_schedule').select('*').order('day_of_week')
  if (error) { console.error(`  Error reading from prod:`, error.message); return }
  if (!data.length) { console.log(`  No rows found.`); return }

  const { error: upsertError } = await dev.from('day_schedule').upsert(data, { onConflict: 'day_of_week' })
  if (upsertError) console.error(`  Error upserting into dev:`, upsertError.message)
  else console.log(`  Copied ${data.length} rows.`)
}

async function main() {
  console.log('Copying prod → dev...')
  await copyTable('sections', 'sort_order')
  await copyTable('checklist_items', 'sort_order')
  await copyDaySchedule()
  console.log('\nDone.')
}

main()
