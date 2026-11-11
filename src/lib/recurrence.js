// Recurrence rules (stored as JSON in checklist_items.recurrence_rule)
//
//   { type: 'daily' }
//   { type: 'weekly', days: [0..6] }                      0 = Sunday
//   { type: 'occasional', standup?: bool, finished_on? }  "Tracked": added to a day by hand
//   { type: 'once', date: 'YYYY-MM-DD' }                  one-off on a date ("Upcoming")
//   { type: 'interval', every: N, unit: 'day'|'week'|'month'|'year', start: 'YYYY-MM-DD' }
//                                                         "Recurring": appears automatically
//   { type: 'range', start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
//                                                         "Focus": every day between start and end

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function toDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function addDays(str, n) {
  const d = parseDate(str)
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

// Whole days from a to b (b - a)
export function daysBetween(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / 86400000)
}

export function formatShort(str) {
  return parseDate(str).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// "Today", "Tomorrow", "in 5 days", "3 days ago"
export function relativeLabel(str, today) {
  const n = daysBetween(today, str)
  if (n === 0) return 'Today'
  if (n === 1) return 'Tomorrow'
  if (n === -1) return 'Yesterday'
  if (n > 1) return `in ${n} days`
  return `${-n} days ago`
}

function lastDayOfMonth(y, m) {
  return new Date(y, m + 1, 0).getDate()
}

// Is an interval rule due on dateStr?
function intervalDue(rule, dateStr) {
  const every = Math.max(1, Number(rule.every) || 1)
  if (!rule.start || dateStr < rule.start) return false
  const unit = rule.unit || 'week'
  if (unit === 'day' || unit === 'week') {
    const step = unit === 'day' ? every : every * 7
    return daysBetween(rule.start, dateStr) % step === 0
  }
  const s = parseDate(rule.start)
  const d = parseDate(dateStr)
  const months = (d.getFullYear() - s.getFullYear()) * 12 + (d.getMonth() - s.getMonth())
  const step = unit === 'year' ? every * 12 : every
  if (months % step !== 0) return false
  // Same day of month as the start; clamp to month end (e.g. the 31st → 30th)
  const target = Math.min(s.getDate(), lastDayOfMonth(d.getFullYear(), d.getMonth()))
  return d.getDate() === target
}

// Does this item appear on dateStr automatically (without being added by hand)?
export function isDueOn(rule, dateStr) {
  if (!rule) return false
  switch (rule.type) {
    case 'daily': return true
    case 'weekly': return (rule.days || []).includes(parseDate(dateStr).getDay())
    case 'once': return rule.date === dateStr
    case 'interval': return intervalDue(rule, dateStr)
    case 'range': return !!rule.start && !!rule.end && dateStr >= rule.start && dateStr <= rule.end
    default: return false
  }
}

// Next date on/after fromStr that an interval rule is due (searches up to ~2 years)
export function nextDue(rule, fromStr) {
  if (rule?.type !== 'interval') return null
  let d = fromStr < rule.start ? rule.start : fromStr
  for (let i = 0; i < 800; i++) {
    if (intervalDue(rule, d)) return d
    d = addDays(d, 1)
  }
  return null
}

const UNIT_LABEL = { day: 'day', week: 'week', month: 'month', year: 'year' }

export function describeInterval(rule) {
  const every = Number(rule.every) || 1
  const unit = UNIT_LABEL[rule.unit] || 'week'
  const base = every === 1 ? `Every ${unit}` : `Every ${every} ${unit}s`
  if (!rule.start) return base
  const s = parseDate(rule.start)
  if (rule.unit === 'week') return `${base} on ${DAY_LABELS[s.getDay()]}`
  if (rule.unit === 'month') return `${base} on the ${ordinal(s.getDate())}`
  if (rule.unit === 'year') return `${base} on ${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  return base
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

// Focus progress on a date: { day, total } or null if outside the range
export function focusProgress(rule, dateStr) {
  if (rule?.type !== 'range' || !isDueOn(rule, dateStr)) return null
  return { day: daysBetween(rule.start, dateStr) + 1, total: daysBetween(rule.start, rule.end) + 1 }
}

export function describeRule(rule) {
  if (!rule) return ''
  switch (rule.type) {
    case 'daily': return 'Every day'
    case 'weekly': return DAY_LABELS.filter((_, i) => rule.days?.includes(i)).join(', ') || 'No days'
    case 'occasional': return rule.standup ? 'Tracked · Standup' : 'Tracked'
    case 'once': return rule.date ? `Once: ${formatShort(rule.date)}` : 'Once (no date)'
    case 'interval': return describeInterval(rule)
    case 'range': return rule.start && rule.end ? `Focus: ${formatShort(rule.start)} – ${formatShort(rule.end)}` : 'Focus'
    default: return rule.type
  }
}
