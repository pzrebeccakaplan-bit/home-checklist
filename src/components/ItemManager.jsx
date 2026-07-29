import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function todayLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const BLANK_FORM = {
  text: '',
  section: 'morning_shared',
  recurrence_type: 'daily',
  recurrence_days: [],
}

function ItemRow({ item, sectionLabel, recurrenceMeta, onEdit, onToggleActive, onDelete, onConvertToSection }) {
  return (
    <div className={`item-row ${!item.active ? 'inactive' : ''}`}>
      <div className="item-row-text">
        <span>{item.text}</span>
        <div className="item-meta-row">
          <span className="item-meta item-meta-section">{sectionLabel[item.section] || item.section}</span>
          <span className="item-meta">{recurrenceMeta(item)}</span>
        </div>
      </div>
      <div className="item-row-actions">
        <button className="btn-small" onClick={() => onEdit(item)}>Edit</button>
        <button className="btn-small" onClick={() => onToggleActive(item)}>
          {item.active ? 'Deactivate' : 'Reactivate'}
        </button>
        <button className="btn-small btn-danger" onClick={() => onDelete(item)}>Delete</button>
        <button className="btn-small btn-convert" onClick={() => onConvertToSection(item)} title="Convert to section">→ Section</button>
      </div>
    </div>
  )
}

export function ItemManager({ sections, onClose, initialEditItem, onSectionAdded }) {
  const SECTIONS = sections.map(s => ({ value: s.id, label: s.label }))
  const sectionLabel = Object.fromEntries(sections.map(s => [s.id, s.label]))
  const [items, setItems] = useState([])
  const [futureOverrides, setFutureOverrides] = useState([]) // { item_id, active_on }
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(BLANK_FORM)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [filterSection, setFilterSection] = useState('all')
  const [filterRecurrence, setFilterRecurrence] = useState('all')
  const [search, setSearch] = useState('')
  const [newScheduleDate, setNewScheduleDate] = useState('')
  const modalRef = useRef(null)

  useEffect(() => {
    fetchItems()
    if (initialEditItem) startEdit(initialEditItem)
  }, [])

  async function fetchItems() {
    const today = todayLocal()
    const [{ data: allItems }, { data: overrides }] = await Promise.all([
      supabase.from('checklist_items').select('*').order('section').order('sort_order'),
      supabase.from('daily_item_overrides').select('item_id, active_on').gte('active_on', today).order('active_on'),
    ])
    setItems(allItems || [])
    setFutureOverrides(overrides || [])
    setLoading(false)
  }

  // Build map: item_id -> sorted list of upcoming dates
  const futureOverridesByItem = {}
  for (const o of futureOverrides) {
    if (!futureOverridesByItem[o.item_id]) futureOverridesByItem[o.item_id] = []
    futureOverridesByItem[o.item_id].push(o.active_on)
  }

  function startEdit(item) {
    const rule = item.recurrence_rule
    setEditingId(item.id)
    setForm({
      text: item.text,
      section: item.section,
      recurrence_type: rule.type,
      recurrence_days: rule.days || [],
    })
    modalRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(BLANK_FORM)
  }

  function buildRule() {
    if (form.recurrence_type === 'weekly') return { type: 'weekly', days: form.recurrence_days }
    return { type: form.recurrence_type }
  }

  async function saveItem() {
    if (!form.text.trim()) return
    setSaving(true)
    const payload = {
      text: form.text.trim(),
      section: form.section,
      recurrence_rule: buildRule(),
    }
    if (editingId) {
      await supabase.from('checklist_items').update(payload).eq('id', editingId)
    } else {
      const maxOrder = Math.max(0, ...items.filter(i => i.section === form.section).map(i => i.sort_order))
      await supabase.from('checklist_items').insert({ ...payload, active: true, sort_order: maxOrder + 10 })
    }
    cancelEdit()
    setSaving(false)
    fetchItems()
  }

  async function toggleActive(item) {
    if (!item.active) {
      // Check if the item's section still exists
      const sectionExists = sections.some(s => s.id === item.section)
      if (!sectionExists) {
        const firstSection = SECTIONS[0]?.value
        if (!firstSection) return
        const newSection = prompt(
          `The section this item belonged to no longer exists. Which section should it go in?\n\n${SECTIONS.map((s, i) => `${i + 1}. ${s.label}`).join('\n')}\n\nEnter a number:`)
        const idx = parseInt(newSection) - 1
        const targetSection = SECTIONS[idx]?.value ?? firstSection
        await supabase.from('checklist_items').update({ active: true, section: targetSection }).eq('id', item.id)
        fetchItems()
        return
      }
    }
    await supabase.from('checklist_items').update({ active: !item.active }).eq('id', item.id)
    fetchItems()
  }

  async function deleteItem(item) {
    if (!confirm(`Permanently delete "${item.text}"?`)) return
    await supabase.from('checklist_items').delete().eq('id', item.id)
    fetchItems()
  }

  async function deleteSection(sectionId) {
    const label = sectionLabel[sectionId] || sectionId
    if (!confirm(`Delete section "${label}"? All its items will be deactivated.`)) return
    await supabase.from('checklist_items').update({ active: false }).eq('section', sectionId)
    await supabase.from('sections').delete().eq('id', sectionId)
    onSectionAdded?.()
    fetchItems()
  }

  async function convertToSection(item) {
    if (!confirm(`Convert "${item.text}" into a new section above its current section? The item will be deleted.`)) return
    const slug = item.text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
    const sorted = [...sections].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    const idx = sorted.findIndex(s => s.id === item.section)
    const current = sorted[idx]
    const prev = idx > 0 ? sorted[idx - 1] : null
    const newSortOrder = prev != null
      ? ((prev.sort_order || 0) + (current?.sort_order || 0)) / 2
      : (current?.sort_order || 10) - 5
    await supabase.from('sections').insert({ id: slug, label: item.text, sort_order: newSortOrder })
    await supabase.from('checklist_items').update({ active: false }).eq('id', item.id)
    onSectionAdded?.()
    fetchItems()
  }

  async function addScheduledDate(date) {
    if (!date || !editingId) return
    await supabase.from('daily_item_overrides').upsert(
      { item_id: editingId, active_on: date },
      { onConflict: 'item_id,active_on' }
    )
    setNewScheduleDate('')
    fetchItems()
  }

  async function removeScheduledDate(date) {
    if (!editingId) return
    await supabase.from('daily_item_overrides').delete().eq('item_id', editingId).eq('active_on', date)
    fetchItems()
  }

  function toggleDay(day) {
    setForm(f => ({
      ...f,
      recurrence_days: f.recurrence_days.includes(day)
        ? f.recurrence_days.filter(d => d !== day)
        : [...f.recurrence_days, day]
    }))
  }

  function recurrenceMeta(item) {
    const rule = item.recurrence_rule
    if (rule.type === 'daily') return 'Every day'
    if (rule.type === 'weekly') return DAY_LABELS.filter((_, i) => rule.days?.includes(i)).join(', ')
    if (rule.type === 'occasional') {
      const dates = futureOverridesByItem[item.id]
      if (dates?.length) {
        return dates.map(d => {
          const [y, m, dd] = d.split('-').map(Number)
          return new Date(y, m - 1, dd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        }).join(', ')
      }
      return 'Occasional (no upcoming dates)'
    }
    return rule.type
  }

  const searchLower = search.trim().toLowerCase()
  const filtered = items.filter(item => {
    if (filterSection !== 'all' && item.section !== filterSection) return false
    if (searchLower && !item.text.toLowerCase().includes(searchLower)) return false
    const type = item.recurrence_rule.type
    if (filterRecurrence === 'daily') return type === 'daily' && item.active
    if (filterRecurrence === 'weekly') return type === 'weekly' && item.active
    if (filterRecurrence === 'occasional') return type === 'occasional' && item.active
    if (filterRecurrence === 'future-oneoffs') {
      return type === 'occasional' && item.active && (futureOverridesByItem[item.id]?.length > 0)
    }
    return true
  })

  const activeFiltered = filtered.filter(i => i.active)
  const inactiveFiltered = filtered.filter(i => !i.active)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" ref={modalRef} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Manage Template</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="manager-form">
          <h3>{editingId ? 'Edit Item' : 'Add New Item'}</h3>
          <input
            className="form-input"
            placeholder="Item text"
            value={form.text}
            onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
          />
          <select
            className="form-input"
            value={form.section}
            onChange={e => setForm(f => ({ ...f, section: e.target.value }))}
          >
            {SECTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>

          <div className="recurrence-row">
            <label>
              <input type="radio" name="rec" value="daily"
                checked={form.recurrence_type === 'daily'}
                onChange={() => setForm(f => ({ ...f, recurrence_type: 'daily' }))} />
              {' '}Every day
            </label>
            <label>
              <input type="radio" name="rec" value="weekly"
                checked={form.recurrence_type === 'weekly'}
                onChange={() => setForm(f => ({ ...f, recurrence_type: 'weekly' }))} />
              {' '}Specific days
            </label>
            <label>
              <input type="radio" name="rec" value="occasional"
                checked={form.recurrence_type === 'occasional'}
                onChange={() => setForm(f => ({ ...f, recurrence_type: 'occasional' }))} />
              {' '}Occasional
            </label>
          </div>

          {form.recurrence_type === 'weekly' && (
            <div className="day-picker">
              {DAY_LABELS.map((label, i) => (
                <button key={i} type="button"
                  className={`day-btn ${form.recurrence_days.includes(i) ? 'selected' : ''}`}
                  onClick={() => toggleDay(i)}>
                  {label}
                </button>
              ))}
            </div>
          )}

          {form.recurrence_type === 'occasional' && editingId && (
            <div className="scheduled-dates">
              <p className="scheduled-dates-label">Scheduled dates</p>
              {(futureOverridesByItem[editingId] || []).length === 0 ? (
                <p className="scheduled-dates-empty">No upcoming dates scheduled.</p>
              ) : (
                <div className="scheduled-dates-list">
                  {(futureOverridesByItem[editingId] || []).map(d => {
                    const [y, m, dd] = d.split('-').map(Number)
                    const label = new Date(y, m - 1, dd).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                    return (
                      <div key={d} className="scheduled-date-chip">
                        <span>{label}</span>
                        <button onClick={() => removeScheduledDate(d)} aria-label="Remove date">✕</button>
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="scheduled-date-add">
                <input
                  type="date"
                  className="form-input"
                  value={newScheduleDate}
                  min={todayLocal()}
                  onChange={e => setNewScheduleDate(e.target.value)}
                />
                <button
                  className="btn-primary"
                  onClick={() => addScheduledDate(newScheduleDate)}
                  disabled={!newScheduleDate}
                >Add date</button>
              </div>
            </div>
          )}

          <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
            {editingId && <button className="btn-secondary" onClick={cancelEdit}>Cancel</button>}
            <button className="btn-primary" onClick={saveItem} disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Item'}
            </button>
          </div>
        </div>

        <div className="manager-filter">
          <input
            className="form-input"
            placeholder="Search items…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="form-input" value={filterSection} onChange={e => setFilterSection(e.target.value)}>
            <option value="all">All sections</option>
            {SECTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select className="form-input" value={filterRecurrence} onChange={e => setFilterRecurrence(e.target.value)}>
            <option value="all">All types</option>
            <option value="daily">Daily</option>
            <option value="weekly">Specific days</option>
            <option value="occasional">Occasional</option>
            <option value="future-oneoffs">Upcoming one-offs</option>
          </select>
        </div>

        {loading ? <p>Loading…</p> : (
          <>
            {SECTIONS.map(sec => {
              const secActive = activeFiltered.filter(i => i.section === sec.value)
              if (filterSection !== 'all' && sec.value !== filterSection) return null
              if (secActive.length === 0 && filterRecurrence !== 'all') return null
              return (
                <div key={sec.value} className="manager-section-group">
                  <div className="item-section-group-header">
                    <span>{sec.label}</span>
                    <button className="btn-small btn-danger" onClick={() => deleteSection(sec.value)}>Delete Section</button>
                  </div>
                  {secActive.length === 0
                    ? <p className="empty-state" style={{ padding: '0.4rem 0', fontSize: '0.85rem' }}>No active items</p>
                    : <div className="item-list">{secActive.map(item => <ItemRow key={item.id} item={item} sectionLabel={sectionLabel} recurrenceMeta={recurrenceMeta} onEdit={startEdit} onToggleActive={toggleActive} onDelete={deleteItem} onConvertToSection={convertToSection} />)}</div>
                  }
                </div>
              )
            })}
            {inactiveFiltered.length > 0 && (
              <div className="deactivated-section">
                <div className="deactivated-header">Deactivated</div>
                <div className="item-list">
                  {inactiveFiltered.map(item => <ItemRow key={item.id} item={item} sectionLabel={sectionLabel} recurrenceMeta={recurrenceMeta} onEdit={startEdit} onToggleActive={toggleActive} onDelete={deleteItem} onConvertToSection={convertToSection} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
