// Same changes as supabase/migrations/003_occasionals_redesign.sql, via the API.
// Usage: SUPABASE_URL=... SUPABASE_KEY=... node scripts/migrate-occasionals.mjs
import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

const { data: items, error } = await db.from('checklist_items').select('*').eq('active', true)
if (error) throw error

let n = 0
for (const item of items) {
  const rule = item.recurrence_rule || {}
  let patch = null
  if (item.section === 'ongoing_tracked_in_standup' && rule.type === 'occasional') {
    patch = { section: 'morning_shared', recurrence_rule: { ...rule, standup: true } }
  } else if (rule.type === 'once' && !rule.date) {
    patch = { recurrence_rule: { type: 'occasional' } }
  }
  if (!patch) continue
  const { error: e } = await db.from('checklist_items').update(patch).eq('id', item.id)
  console.log(e ? `FAILED ${item.text}: ${e.message}` : `updated: ${item.text}`)
  if (!e) n++
}
console.log(`${n} items updated`)
