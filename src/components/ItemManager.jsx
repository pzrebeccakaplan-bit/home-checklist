import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const SECTIONS = [
  { value: 'morning_shared',    label: 'Morning — Everyone' },
  { value: 'morning_rebecca',   label: "Rebecca's Morning" },
  { value: 'morning_pz',        label: "PZ's Morning" },
  { value: 'evening_shared',    label: 'Evening — Everyone' },
  { value: 'evening_rebecca',   label: "Rebecca's Evening" },
  { value: 'evening_pz',        label: "PZ's Evening" },
  { value: 'before_bed_discuss',label: 'Before Bed — Discuss Together' },
  { value: 'last_to_bed',       label: 'Last One to Bed' },
]

const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const BLANK_FORM = {
  text: '',
  section: 'morning_shared',
  recurrence_type: 'daily',
  recurrence_days: [],
  sort_order: 0,
}

export function ItemManager({ onClose }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(BLANK_FORM)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [filterSection, setFilterSection] = useState('all')

  useEffect(() => { fetchItems() }, [])

  async function fetchItems() {
    const { data } = await supabase
      .from('checklist_items')
      .select('*')
      .order('section')
      .order('sort_order')
    setItems(data || [])
    setLoading(false)
  }

  function startEdit(item) {
    const rule = item.recurrence_rule
    setEditingId(item.id)
    setForm({
      text: item.text,
      section: item.section,
      recurrence_type: rule.type,
      recurrence_days: rule.days || [],
      sort_order: item.sort_order,
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(BLANK_FORM)
  }

  function buildRule() {
    if (form.recurrence_type === 'weekly') {
      return { type: 'weekly', days: form.recurrence_days }
    }
    return { type: form.recurrence_type }
  }

  async function saveItem() {
    if (!form.text.trim()) return
    setSaving(true)
    const payload = {
      text: form.text.trim(),
      section: form.section,
      recurrence_rule: buildRule(),
      sort_order: Number(form.sort_order) || 0,
    }
    if (editingId) {
      await supabase.from('checklist_items').update(payload).eq('id', editingId)
    } else {
      await supabase.from('checklist_items').insert({ ...payload, active: true })
    }
    cancelEdit()
    setSaving(false)
    fetchItems()
  }

  async function toggleActive(item) {
    await supabase
      .from('checklist_items')
      .update({ active: !item.active })
      .eq('id', item.id)
    fetchItems()
  }

  async function deleteItem(item) {
    if (!confirm(`Delete "${item.text}"? This also deletes all history for this item.`)) return
    await supabase.from('checklist_items').delete().eq('id', item.id)
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

  const filtered = filterSection === 'all' ? items : items.filter(i => i.section === filterSection)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Manage Items</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Add / Edit form */}
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
                <button
                  key={i}
                  type="button"
                  className={`day-btn ${form.recurrence_days.includes(i) ? 'selected' : ''}`}
                  onClick={() => toggleDay(i)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <div className="form-row">
            <label>
              Sort order{' '}
              <input
                type="number"
                className="form-input-small"
                value={form.sort_order}
                onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))}
              />
            </label>
            <div className="form-actions">
              {editingId && <button className="btn-secondary" onClick={cancelEdit}>Cancel</button>}
              <button className="btn-primary" onClick={saveItem} disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>

        {/* Filter + list */}
        <div className="manager-filter">
          <select
            className="form-input"
            value={filterSection}
            onChange={e => setFilterSection(e.target.value)}
          >
            <option value="all">All sections</option>
            {SECTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        {loading ? <p>Loading…</p> : (
          <div className="item-list">
            {filtered.map(item => (
              <div key={item.id} className={`item-row ${!item.active ? 'inactive' : ''}`}>
                <div className="item-row-text">
                  <span>{item.text}</span>
                  <span className="item-meta">
                    {item.recurrence_rule.type === 'weekly'
                      ? DAY_LABELS.filter((_, i) => item.recurrence_rule.days?.includes(i)).join(', ')
                      : item.recurrence_rule.type}
                  </span>
                </div>
                <div className="item-row-actions">
                  <button className="btn-small" onClick={() => startEdit(item)}>Edit</button>
                  <button className="btn-small" onClick={() => toggleActive(item)}>
                    {item.active ? 'Deactivate' : 'Reactivate'}
                  </button>
                  <button className="btn-small btn-danger" onClick={() => deleteItem(item)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
