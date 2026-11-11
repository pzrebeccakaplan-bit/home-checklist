import { DAY_LABELS, addDays, daysBetween, describeRule } from '../lib/recurrence'

export const TYPE_OPTIONS = [
  { value: 'occasional', label: 'Tracked' },
  { value: 'once', label: 'One-off date' },
  { value: 'interval', label: 'Recurring' },
  { value: 'weekly', label: 'Specific weekdays' },
  { value: 'range', label: 'Focus (daily for a while)' },
  { value: 'daily', label: 'Every day' },
]

// Sensible starting rule when switching to a type
export function defaultRule(type, baseDate) {
  switch (type) {
    case 'once': return { type, date: baseDate }
    case 'interval': return { type, every: 1, unit: 'week', start: baseDate }
    case 'weekly': return { type, days: [] }
    case 'range': return { type, start: baseDate, end: addDays(baseDate, 6) }
    case 'occasional': return { type }
    default: return { type }
  }
}

export function ruleIsValid(rule) {
  switch (rule.type) {
    case 'once': return !!rule.date
    case 'interval': return !!rule.start && Number(rule.every) >= 1
    case 'weekly': return (rule.days || []).length > 0
    case 'range': return !!rule.start && !!rule.end && rule.end >= rule.start
    default: return true
  }
}

// Edits the "when" part of an item. value = rule object, onChange(newRule)
export function RuleFields({ value: rule, onChange, baseDate, showTypePicker = false }) {
  const set = patch => onChange({ ...rule, ...patch })

  return (
    <div className="rule-fields">
      {showTypePicker && (
        <select
          className="form-input"
          value={rule.type}
          onChange={e => onChange(defaultRule(e.target.value, baseDate))}
        >
          {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}

      {rule.type === 'occasional' && (
        <label className="rule-check">
          <input type="checkbox" checked={!!rule.standup} onChange={e => set({ standup: e.target.checked })} />
          {' '}Review in bi-weekly standup
        </label>
      )}

      {rule.type === 'once' && (
        <label className="rule-inline">
          Date
          <input type="date" className="form-input" value={rule.date || ''} onChange={e => set({ date: e.target.value })} />
        </label>
      )}

      {rule.type === 'weekly' && (
        <div className="day-picker">
          {DAY_LABELS.map((d, i) => {
            const on = (rule.days || []).includes(i)
            return (
              <button key={i} type="button" className={`day-btn ${on ? 'selected' : ''}`}
                onClick={() => set({ days: on ? rule.days.filter(x => x !== i) : [...(rule.days || []), i].sort() })}>
                {d}
              </button>
            )
          })}
        </div>
      )}

      {rule.type === 'interval' && (
        <>
          <div className="rule-inline">
            Every
            <input type="number" min="1" className="form-input rule-num" value={rule.every ?? 1}
              onChange={e => set({ every: Math.max(1, parseInt(e.target.value) || 1) })} />
            <select className="form-input" value={rule.unit || 'week'} onChange={e => set({ unit: e.target.value })}>
              <option value="day">{Number(rule.every) === 1 ? 'day' : 'days'}</option>
              <option value="week">{Number(rule.every) === 1 ? 'week' : 'weeks'}</option>
              <option value="month">{Number(rule.every) === 1 ? 'month' : 'months'}</option>
              <option value="year">{Number(rule.every) === 1 ? 'year' : 'years'}</option>
            </select>
          </div>
          <label className="rule-inline">
            Starting
            <input type="date" className="form-input" value={rule.start || ''} onChange={e => set({ start: e.target.value })} />
          </label>
          {rule.start && <p className="rule-hint">{describeRule(rule)}</p>}
        </>
      )}

      {rule.type === 'range' && (
        <>
          <label className="rule-inline">
            From
            <input type="date" className="form-input" value={rule.start || ''}
              onChange={e => {
                const len = rule.start && rule.end ? daysBetween(rule.start, rule.end) : 6
                set({ start: e.target.value, end: e.target.value ? addDays(e.target.value, Math.max(0, len)) : rule.end })
              }} />
          </label>
          <div className="rule-inline">
            For
            <input type="number" min="1" className="form-input rule-num"
              value={rule.start && rule.end ? daysBetween(rule.start, rule.end) + 1 : 7}
              onChange={e => { const n = Math.max(1, parseInt(e.target.value) || 1); set({ end: addDays(rule.start, n - 1) }) }} />
            days
          </div>
          {rule.end && <p className="rule-hint">Shows every day until {new Date(rule.end + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>}
        </>
      )}
    </div>
  )
}
