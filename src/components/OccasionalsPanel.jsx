import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  isDueOn, nextDue, addDays, formatShort, relativeLabel, describeRule, focusProgress, toDateStr,
} from '../lib/recurrence'
import { RuleFields, defaultRule, ruleIsValid } from './RuleFields'

// Same 5am rollover the rest of the app uses
function todayLocal() {
  const d = new Date()
  if (d.getHours() < 5) d.setDate(d.getDate() - 1)
  return toDateStr(d)
}

const TABS = [
  { id: 'tracked', label: 'Tracked', type: 'occasional', addLabel: '+ New tracked item' },
  { id: 'upcoming', label: 'Upcoming', type: 'once', addLabel: '+ New one-off' },
  { id: 'recurring', label: 'Recurring', type: 'interval', addLabel: '+ New recurring item' },
  { id: 'focus', label: 'Focus', type: 'range', addLabel: '+ New focus item' },
]

// Next date (on/after from) an item shows up automatically, looking ahead `days`
function nextAutoDate(rule, from, days = 400) {
  if (rule.type === 'interval') return nextDue(rule, from)
  for (let i = 0; i < days; i++) {
    const d = addDays(from, i)
    if (isDueOn(rule, d)) return d
  }
  return null
}

// ── Add / edit form ─────────────────────────────────────────
function ItemForm({ initial, sections, baseDate, isEdit, onSave, onCancel }) {
  const [text, setText] = useState(initial.text || '')
  const [section, setSection] = useState(initial.section || (sections.some(s => s.id === 'morning_shared') ? 'morning_shared' : sections[0]?.id) || '')
  const [rule, setRule] = useState(initial.rule)
  const [saving, setSaving] = useState(false)
  const valid = text.trim() && section && ruleIsValid(rule)

  async function submit(e) {
    e.preventDefault()
    if (!valid) return
    setSaving(true)
    await onSave({ text: text.trim(), section, rule })
    setSaving(false)
  }

  return (
    <form className="occ-form" onSubmit={submit}>
      <input autoFocus className="form-input" placeholder="What is it?" value={text} onChange={e => setText(e.target.value)} />
      <label className="rule-inline">
        Shows in
        <select className="form-input" value={section} onChange={e => setSection(e.target.value)}>
          {sections.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </label>
      <RuleFields value={rule} onChange={setRule} baseDate={baseDate} showTypePicker={isEdit} />
      <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={!valid || saving}>{saving ? 'Saving…' : isEdit ? 'Save' : 'Add'}</button>
      </div>
    </form>
  )
}

// ── Main panel ──────────────────────────────────────────────
export function OccasionalsPanel({ sections, viewDate, user, onClose, onChanged }) {
  const today = todayLocal()
  const tomorrow = addDays(today, 1)
  const sectionLabel = useMemo(() => Object.fromEntries(sections.map(s => [s.id, s.label])), [sections])
  const sectionOrder = useMemo(() => Object.fromEntries(sections.map((s, i) => [s.id, i])), [sections])

  const [tab, setTab] = useState('tracked')
  const [items, setItems] = useState([])
  const [finished, setFinished] = useState([])
  const [overrides, setOverrides] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [showFinished, setShowFinished] = useState(false)
  const [showEnded, setShowEnded] = useState(false)

  // Evening review → default to adding to tomorrow
  const [target, setTarget] = useState(() => {
    if (viewDate && viewDate !== today) return viewDate
    return new Date().getHours() >= 17 ? tomorrow : today
  })

  const createdBy = user && user.id !== 'dev-user' ? { created_by: user.id } : {}

  const load = useCallback(async () => {
    const since = addDays(today, -120)
    const [r1, r2, r3, r4] = await Promise.all([
      supabase.from('checklist_items').select('*').eq('active', true)
        .in('recurrence_rule->>type', ['occasional', 'interval', 'range', 'weekly']).order('sort_order'),
      supabase.from('checklist_items').select('*').eq('active', true)
        .eq('recurrence_rule->>type', 'once').gte('recurrence_rule->>date', today),
      supabase.from('checklist_items').select('*').eq('active', false)
        .eq('recurrence_rule->>type', 'occasional').not('recurrence_rule->>finished_on', 'is', null)
        .order('recurrence_rule->>finished_on', { ascending: false }).limit(30),
      supabase.from('daily_item_overrides').select('item_id, active_on').gte('active_on', since),
    ])
    setItems([...(r1.data || []), ...(r2.data || [])])
    setFinished(r3.data || [])
    setOverrides(r4.data || [])
    setLoading(false)
  }, [today])

  useEffect(() => { load() }, [load])

  async function afterChange() {
    await load()
    onChanged?.()
  }

  // item_id → sorted list of dates it was added to
  const overrideDates = useMemo(() => {
    const m = {}
    for (const o of overrides) (m[o.item_id] ||= []).push(o.active_on)
    for (const k in m) m[k].sort()
    return m
  }, [overrides])

  const q = search.trim().toLowerCase()
  const matches = item => !q || item.text.toLowerCase().includes(q)
  const byType = type => items.filter(i => i.recurrence_rule?.type === type && matches(i))

  // ── Actions ──
  async function toggleOnDate(item, date) {
    const on = overrideDates[item.id]?.includes(date)
    if (on) {
      setOverrides(prev => prev.filter(o => !(o.item_id === item.id && o.active_on === date)))
      await supabase.from('daily_item_overrides').delete().eq('item_id', item.id).eq('active_on', date)
    } else {
      setOverrides(prev => [...prev, { item_id: item.id, active_on: date }])
      await supabase.from('daily_item_overrides').upsert({ item_id: item.id, active_on: date, ...createdBy }, { onConflict: 'item_id,active_on' })
    }
    afterChange()
  }

  async function saveNew({ text, section, rule }) {
    const { data: top } = await supabase.from('checklist_items').select('sort_order')
      .eq('section', section).order('sort_order').limit(1)
    const sort_order = (top?.[0]?.sort_order ?? 10) - 5
    await supabase.from('checklist_items').insert({ text, section, recurrence_rule: rule, active: true, sort_order })
    setAdding(false)
    afterChange()
  }

  async function saveEdit(item, { text, section, rule }) {
    await supabase.from('checklist_items').update({ text, section, recurrence_rule: rule }).eq('id', item.id)
    setEditingId(null)
    afterChange()
  }

  async function update(item, patch) {
    await supabase.from('checklist_items').update(patch).eq('id', item.id)
    afterChange()
  }

  async function remove(item) {
    if (!confirm(`Delete "${item.text}"? Past history is kept.`)) return
    await update(item, { active: false })
  }

  function finish(item) {
    return update(item, { active: false, recurrence_rule: { ...item.recurrence_rule, finished_on: today } })
  }

  function restore(item) {
    const { finished_on, ...rule } = item.recurrence_rule
    return update(item, { active: true, recurrence_rule: rule })
  }

  // ── Rendering helpers ──
  function rowShell(item, { left, meta, actions }) {
    if (editingId === item.id) {
      return (
        <div key={item.id} className="occ-row editing">
          <ItemForm
            initial={{ text: item.text, section: item.section, rule: item.recurrence_rule }}
            sections={sections} baseDate={target} isEdit
            onSave={vals => saveEdit(item, vals)} onCancel={() => setEditingId(null)}
          />
        </div>
      )
    }
    return (
      <div key={item.id} className="occ-row">
        {left}
        <div className="occ-row-body">
          <span className="occ-row-text">{item.text}</span>
          <span className="occ-row-meta">{meta}</span>
        </div>
        <div className="occ-row-actions">
          {actions}
          <button className="occ-icon-btn" title="Edit" onClick={() => { setAdding(false); setEditingId(item.id) }}>✎</button>
          <button className="occ-icon-btn" title="Delete" onClick={() => remove(item)}>🗑</button>
        </div>
      </div>
    )
  }

  function trackedMeta(item, showSection) {
    const dates = overrideDates[item.id] || []
    const future = dates.filter(d => d >= today && d !== target)
    const past = dates.filter(d => d < today)
    const parts = showSection ? [sectionLabel[item.section] || item.section] : []
    if (future.length) parts.push(`On ${future.map(formatShort).join(', ')}`)
    else if (past.length) parts.push(`Last on list ${relativeLabel(past[past.length - 1], today)}`)
    else parts.push('Not on a list yet')
    return parts.join(' · ')
  }

  function trackedRow(item, showSection = false) {
    const on = overrideDates[item.id]?.includes(target)
    return rowShell(item, {
      left: (
        <button className={`occ-check ${on ? 'on' : ''}`} onClick={() => toggleOnDate(item, target)}
          title={on ? 'Remove from that day' : 'Add to that day'} aria-pressed={on}>
          <span className="check-box">{on ? '✓' : ''}</span>
        </button>
      ),
      meta: trackedMeta(item, showSection),
      actions: <button className="occ-text-btn" title="Mark finished — removes it from the Tracked list" onClick={() => finish(item)}>Done</button>,
    })
  }

  // ── Tabs ──
  function renderTracked() {
    const tracked = byType('occasional')
    const standup = tracked.filter(i => i.recurrence_rule.standup)
    const others = tracked.filter(i => !i.recurrence_rule.standup)
    const groups = {}
    for (const i of others) (groups[i.section] ||= []).push(i)
    const groupIds = Object.keys(groups).sort((a, b) => (sectionOrder[a] ?? 999) - (sectionOrder[b] ?? 999))
    const addedCount = tracked.filter(i => overrideDates[i.id]?.includes(target)).length
    const visibleFinished = finished.filter(matches)

    return (
      <>
        <div className="occ-target">
          <span>Tick to add to</span>
          <select className="form-input" value={[today, tomorrow].includes(target) ? target : 'other'}
            onChange={e => setTarget(e.target.value === 'other' ? addDays(tomorrow, 1) : e.target.value)}>
            <option value={today}>Today ({formatShort(today)})</option>
            <option value={tomorrow}>Tomorrow ({formatShort(tomorrow)})</option>
            <option value="other">Another day…</option>
          </select>
          {![today, tomorrow].includes(target) && (
            <input type="date" className="form-input" value={target} onChange={e => e.target.value && setTarget(e.target.value)} />
          )}
          {addedCount > 0 && <span className="occ-target-count">{addedCount} added</span>}
        </div>

        {tracked.length === 0 && !q && <p className="empty-state">Nothing tracked yet.</p>}

        {standup.length > 0 && (
          <div className="occ-group">
            <h3 className="occ-group-title">Bi-weekly standup</h3>
            {standup.map(i => trackedRow(i, true))}
          </div>
        )}
        {groupIds.map(sid => (
          <div key={sid} className="occ-group">
            <h3 className="occ-group-title">{sectionLabel[sid] || sid}</h3>
            {groups[sid].map(i => trackedRow(i))}
          </div>
        ))}

        {visibleFinished.length > 0 && (
          <div className="occ-group occ-muted">
            <button className="occ-collapse" onClick={() => setShowFinished(s => !s)}>
              {showFinished ? '▾' : '▸'} Finished ({visibleFinished.length})
            </button>
            {showFinished && visibleFinished.map(item => (
              <div key={item.id} className="occ-row">
                <div className="occ-row-body">
                  <span className="occ-row-text">{item.text}</span>
                  <span className="occ-row-meta">Finished {relativeLabel(item.recurrence_rule.finished_on, today)}</span>
                </div>
                <div className="occ-row-actions">
                  <button className="occ-text-btn" onClick={() => restore(item)}>Restore</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    )
  }

  function renderUpcoming() {
    const horizon = addDays(today, 60)
    const entries = []
    for (const item of byType('once')) entries.push({ date: item.recurrence_rule.date, item, kind: 'once' })
    for (const item of byType('occasional')) {
      for (const d of overrideDates[item.id] || []) if (d >= today) entries.push({ date: d, item, kind: 'tracked' })
    }
    for (const item of byType('interval')) {
      const d = nextDue(item.recurrence_rule, today)
      if (d && d <= horizon) entries.push({ date: d, item, kind: 'recurring' })
    }
    for (const item of byType('range')) {
      if (item.recurrence_rule.start > today) entries.push({ date: item.recurrence_rule.start, item, kind: 'focus' })
    }
    entries.sort((a, b) => a.date.localeCompare(b.date) || a.item.text.localeCompare(b.item.text))

    const byDate = []
    for (const e of entries) {
      if (!byDate.length || byDate[byDate.length - 1].date !== e.date) byDate.push({ date: e.date, list: [] })
      byDate[byDate.length - 1].list.push(e)
    }

    if (!byDate.length) return <p className="empty-state">Nothing coming up.</p>

    const KIND = { once: 'One-off', tracked: 'Tracked', recurring: 'Recurring', focus: 'Focus starts' }
    return byDate.map(({ date, list }) => (
      <div key={date} className="occ-group">
        <h3 className="occ-group-title">{relativeLabel(date, today)} · {formatShort(date)}</h3>
        {list.map(({ item, kind }) => {
          const meta = `${KIND[kind]} · ${sectionLabel[item.section] || item.section}`
          if (kind === 'tracked') {
            return (
              <div key={item.id + date} className="occ-row">
                <div className="occ-row-body">
                  <span className="occ-row-text">{item.text}</span>
                  <span className="occ-row-meta">{meta}</span>
                </div>
                <div className="occ-row-actions">
                  <button className="occ-text-btn" onClick={() => toggleOnDate(item, date)}>Remove from day</button>
                </div>
              </div>
            )
          }
          return <div key={item.id + date}>{rowShell(item, { meta })}</div>
        })}
      </div>
    ))
  }

  function renderRecurring() {
    const list = [...byType('interval'), ...byType('weekly')]
      .map(item => ({ item, next: nextAutoDate(item.recurrence_rule, today) }))
      .sort((a, b) => (a.next || '9999').localeCompare(b.next || '9999'))
    if (!list.length) return <p className="empty-state">No recurring items yet.</p>
    return (
      <div className="occ-group">
        <p className="occ-hint">These appear on their own on the days they're due.</p>
        {list.map(({ item, next }) => rowShell(item, {
          meta: `${describeRule(item.recurrence_rule)} · ${sectionLabel[item.section] || item.section}`
            + (next ? ` · next ${relativeLabel(next, today).toLowerCase()} (${formatShort(next)})` : ''),
        }))}
      </div>
    )
  }

  function renderFocus() {
    const all = byType('range')
    const current = all.filter(i => i.recurrence_rule.end >= today)
      .sort((a, b) => a.recurrence_rule.start.localeCompare(b.recurrence_rule.start))
    const ended = all.filter(i => i.recurrence_rule.end < today)
      .sort((a, b) => b.recurrence_rule.end.localeCompare(a.recurrence_rule.end))

    return (
      <>
        <p className="occ-hint">Things to work on a bit every day for a set stretch. They drop off after the last day.</p>
        {!current.length && <p className="empty-state">Nothing in focus right now.</p>}
        <div className="occ-group">
          {current.map(item => {
            const r = item.recurrence_rule
            const p = focusProgress(r, today)
            const meta = (p ? `Day ${p.day} of ${p.total}` : `Starts ${relativeLabel(r.start, today).toLowerCase()}`)
              + ` · until ${formatShort(r.end)} · ${sectionLabel[item.section] || item.section}`
            return rowShell(item, {
              meta,
              actions: (
                <>
                  <button className="occ-text-btn" title="Add 7 more days" onClick={() => update(item, { recurrence_rule: { ...r, end: addDays(r.end, 7) } })}>+7 days</button>
                  {r.start <= today && r.end > today && (
                    <button className="occ-text-btn" title="Last day is today" onClick={() => update(item, { recurrence_rule: { ...r, end: today } })}>End today</button>
                  )}
                </>
              ),
            })
          })}
        </div>
        {ended.length > 0 && (
          <div className="occ-group occ-muted">
            <button className="occ-collapse" onClick={() => setShowEnded(s => !s)}>
              {showEnded ? '▾' : '▸'} Ended ({ended.length})
            </button>
            {showEnded && ended.map(item => rowShell(item, {
              meta: `Ended ${formatShort(item.recurrence_rule.end)}`,
              actions: (
                <button className="occ-text-btn" title="Run again for 7 days starting tomorrow"
                  onClick={() => update(item, { recurrence_rule: { ...item.recurrence_rule, start: tomorrow, end: addDays(tomorrow, 6) } })}>
                  Restart
                </button>
              ),
            }))}
          </div>
        )}
      </>
    )
  }

  const tabDef = TABS.find(t => t.id === tab)
  const newBase = tab === 'upcoming' ? (target > today ? target : tomorrow) : target
  const counts = {
    tracked: items.filter(i => i.recurrence_rule?.type === 'occasional').length,
    upcoming: null,
    recurring: items.filter(i => ['interval', 'weekly'].includes(i.recurrence_rule?.type)).length,
    focus: items.filter(i => i.recurrence_rule?.type === 'range' && i.recurrence_rule.end >= today).length,
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide occ-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Occasionals</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="occ-tabs">
          {TABS.map(t => (
            <button key={t.id} className={`occ-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => { setTab(t.id); setAdding(false); setEditingId(null) }}>
              {t.label}{counts[t.id] ? <span className="occ-tab-count">{counts[t.id]}</span> : null}
            </button>
          ))}
        </div>

        <div className="occ-toolbar">
          <input className="form-input" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
          {!adding && <button className="btn-primary" onClick={() => { setEditingId(null); setAdding(true) }}>{tabDef.addLabel}</button>}
        </div>

        {adding && (
          <ItemForm
            key={tab}
            initial={{ rule: defaultRule(tabDef.type, newBase) }}
            sections={sections} baseDate={newBase}
            onSave={saveNew} onCancel={() => setAdding(false)}
          />
        )}

        {loading ? <p>Loading…</p> : (
          <div className="occ-body">
            {tab === 'tracked' && renderTracked()}
            {tab === 'upcoming' && renderUpcoming()}
            {tab === 'recurring' && renderRecurring()}
            {tab === 'focus' && renderFocus()}
          </div>
        )}
      </div>
    </div>
  )
}
