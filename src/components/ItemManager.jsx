import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const DAY_NAMES  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

function todayLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Tag selector dropdown ─────────────────────────────────
function TagSelector({ existingTags, currentTags, onAdd }) {
  const [open, setOpen] = useState(false)
  const [newTag, setNewTag] = useState('')
  const inputRef = useRef(null)
  const available = existingTags.filter(t => !currentTags.includes(t))

  function select(tag) { onAdd(tag); setOpen(false) }

  function submitNew() {
    const t = newTag.trim()
    if (t) { onAdd(t); setNewTag(''); setOpen(false) }
  }

  if (!open) return <button className="tag-add-btn" onClick={() => setOpen(true)}>+ tag</button>

  return (
    <div className="tag-selector-popover">
      {available.map(t => (
        <button key={t} className="tag-selector-option" onMouseDown={() => select(t)}>{t}</button>
      ))}
      <div className="tag-selector-new">
        <input
          ref={inputRef}
          autoFocus
          className="tag-input"
          value={newTag}
          placeholder="new tag…"
          onChange={e => setNewTag(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
          onKeyDown={e => {
            if (e.key === 'Enter') submitNew()
            if (e.key === 'Escape') setOpen(false)
          }}
        />
        <button className="tag-selector-add-btn" onMouseDown={submitNew}>Add</button>
      </div>
      <button className="tag-selector-cancel" onMouseDown={() => setOpen(false)}>Cancel</button>
    </div>
  )
}

// ── Schedule pane ─────────────────────────────────────────
function SchedulePane({ sections, schedule, onUpdateDayTags, onUpdateSectionTags }) {
  const allTags = [...new Set(sections.flatMap(s => s.tags || []))].sort()
  const allTagsWithSchedule = [...new Set([...allTags, ...Object.values(schedule).flat()])].sort()

  function toggleSectionTag(sec, tag) {
    const current = sec.tags || []
    const next = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag]
    onUpdateSectionTags(sec.id, next)
  }

  function toggleDayTag(dow, tag) {
    const current = schedule[dow] || []
    const next = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag]
    onUpdateDayTags(dow, next)
  }

  return (
    <div className="schedule-pane">
      <div className="schedule-block">
        <h3 className="schedule-block-title">Section Tags</h3>
        <p className="schedule-hint">Tag each section so the schedule knows when to show it.</p>
        {sections.map(sec => (
          <div key={sec.id} className="section-tag-row">
            <span className="section-tag-label">{sec.label}</span>
            <div className="tag-chips">
              {(sec.tags || []).map(tag => (
                <span key={tag} className="tag-chip">
                  {tag}
                  <button className="tag-chip-remove" onClick={() => toggleSectionTag(sec, tag)}>×</button>
                </span>
              ))}
              <TagSelector
                existingTags={allTagsWithSchedule}
                currentTags={sec.tags || []}
                onAdd={tag => {
                  const current = sec.tags || []
                  if (!current.includes(tag)) onUpdateSectionTags(sec.id, [...current, tag])
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="schedule-block">
        <h3 className="schedule-block-title">Weekly Schedule</h3>
        {allTags.length === 0 ? (
          <p className="schedule-hint">Add tags to sections above, then configure which days show each tag.</p>
        ) : (
          <>
            <p className="schedule-hint">Toggle which tags appear on each day.</p>
            {DAY_NAMES.map((name, dow) => (
              <div key={dow} className="day-schedule-row">
                <span className="day-schedule-name">{name}</span>
                <div className="day-tag-toggles">
                  {allTags.map(tag => {
                    const active = (schedule[dow] || []).includes(tag)
                    return (
                      <button
                        key={tag}
                        className={`day-tag-btn ${active ? 'active' : ''}`}
                        onClick={() => toggleDayTag(dow, tag)}
                      >{tag}</button>
                    )
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// ── Item row ──────────────────────────────────────────────
function ItemRow({ item, sectionLabel, recurrenceMeta, onEdit, onToggleActive, onDelete, onConvertToSection, selectMode, selected, onSelect }) {
  return (
    <div className={`item-row ${!item.active ? 'inactive' : ''} ${selectMode && selected ? 'item-row-selected' : ''}`} onClick={selectMode ? () => onSelect(item.id) : undefined} style={selectMode ? { cursor: 'pointer' } : undefined}>
      {selectMode && (
        <input type="checkbox" className="item-select-checkbox" checked={selected} onChange={() => onSelect(item.id)} onClick={e => e.stopPropagation()} />
      )}
      <div className="item-row-text">
        <span>{item.text}</span>
        <div className="item-meta-row">
          <span className="item-meta item-meta-section">{sectionLabel[item.section] || item.section}</span>
          <span className="item-meta">{recurrenceMeta(item)}</span>
        </div>
      </div>
      {!selectMode && (
        <div className="item-row-actions">
          <button className="btn-small" onClick={() => onEdit(item)}>Edit</button>
          <button className="btn-small" onClick={() => onToggleActive(item)}>{item.active ? 'Deactivate' : 'Reactivate'}</button>
          <button className="btn-small btn-danger" onClick={() => onDelete(item)}>Delete</button>
          <button className="btn-small btn-convert" onClick={() => onConvertToSection(item)} title="Convert to section">→ Section</button>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────
export function ItemManager({ sections, onClose, initialEditItem, onSectionAdded, onItemChanged, schedule, onUpdateDayTags, onUpdateSectionTags }) {
  const SECTIONS = sections.map(s => ({ value: s.id, label: s.label }))
  const sectionLabel = Object.fromEntries(sections.map(s => [s.id, s.label]))

  const [activePane, setActivePane] = useState('items')
  const [items, setItems] = useState([])
  const [futureOverrides, setFutureOverrides] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ text: '', section: sections[0]?.id || '', recurrence_type: 'daily', recurrence_days: [] })
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [filterSection, setFilterSection] = useState('all')
  const [filterRecurrence, setFilterRecurrence] = useState('all')
  const [search, setSearch] = useState('')
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
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

  const futureOverridesByItem = {}
  for (const o of futureOverrides) {
    if (!futureOverridesByItem[o.item_id]) futureOverridesByItem[o.item_id] = []
    futureOverridesByItem[o.item_id].push(o.active_on)
  }

  function startEdit(item) {
    const rule = item.recurrence_rule
    setEditingId(item.id)
    setForm({ text: item.text, section: item.section, recurrence_type: rule.type, recurrence_days: rule.days || [] })
    modalRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm({ text: '', section: sections[0]?.id || '', recurrence_type: 'daily', recurrence_days: [] })
  }

  function buildRule() {
    if (form.recurrence_type === 'weekly') return { type: 'weekly', days: form.recurrence_days }
    return { type: form.recurrence_type }
  }

  async function saveItem() {
    if (!form.text.trim()) return
    setSaving(true)
    const payload = { text: form.text.trim(), section: form.section, recurrence_rule: buildRule() }
    if (editingId) {
      await supabase.from('checklist_items').update(payload).eq('id', editingId)
    } else {
      const sectionItems = items.filter(i => i.section === form.section)
      const minOrder = sectionItems.length > 0 ? Math.min(...sectionItems.map(i => i.sort_order)) : 10
      await supabase.from('checklist_items').insert({ ...payload, active: true, sort_order: minOrder - 5 })
    }
    cancelEdit()
    setSaving(false)
    fetchItems()
    onItemChanged?.()
  }

  async function toggleActive(item) {
    if (!item.active) {
      const sectionExists = sections.some(s => s.id === item.section)
      if (!sectionExists) {
        const first = SECTIONS[0]?.value
        if (!first) return
        const choice = prompt(`The section for this item no longer exists. Pick a section:\n\n${SECTIONS.map((s, i) => `${i + 1}. ${s.label}`).join('\n')}\n\nEnter a number:`)
        const target = SECTIONS[parseInt(choice) - 1]?.value ?? first
        await supabase.from('checklist_items').update({ active: true, section: target }).eq('id', item.id)
        fetchItems(); onItemChanged?.(); return
      }
    }
    await supabase.from('checklist_items').update({ active: !item.active }).eq('id', item.id)
    fetchItems(); onItemChanged?.()
  }

  async function deleteItem(item) {
    if (!confirm(`Remove "${item.text}" from all future days? Past completion history will be preserved.`)) return
    await supabase.from('checklist_items').update({ active: false }).eq('id', item.id)
    fetchItems(); onItemChanged?.()
  }

  function toggleSelect(id) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function toggleSelectAll() {
    const allIds = filtered.map(i => i.id)
    setSelectedIds(prev => prev.size === allIds.length ? new Set() : new Set(allIds))
  }

  async function deleteSelected() {
    if (selectedIds.size === 0) return
    if (!confirm(`Remove ${selectedIds.size} item${selectedIds.size > 1 ? 's' : ''} from all future days?`)) return
    await supabase.from('checklist_items').update({ active: false }).in('id', [...selectedIds])
    setSelectedIds(new Set())
    setSelectMode(false)
    fetchItems(); onItemChanged?.()
  }

  async function deleteSection(sectionId) {
    const label = sectionLabel[sectionId] || sectionId
    if (!confirm(`Delete section "${label}"? All its items will be deactivated.`)) return
    await supabase.from('checklist_items').update({ active: false }).eq('section', sectionId)
    await supabase.from('sections').delete().eq('id', sectionId)
    onSectionAdded?.(); fetchItems(); onItemChanged?.()
  }

  async function convertToSection(item) {
    if (!confirm(`Convert "${item.text}" into a new section above its current section?`)) return
    const slug = item.text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
    const sorted = [...sections].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    const idx = sorted.findIndex(s => s.id === item.section)
    const current = sorted[idx]; const prev = idx > 0 ? sorted[idx - 1] : null
    const newSortOrder = prev != null ? ((prev.sort_order || 0) + (current?.sort_order || 0)) / 2 : (current?.sort_order || 10) - 5
    await supabase.from('sections').insert({ id: slug, label: item.text, sort_order: newSortOrder })
    await supabase.from('checklist_items').update({ active: false }).eq('id', item.id)
    onSectionAdded?.(); fetchItems(); onItemChanged?.()
  }

  async function addScheduledDate(date) {
    if (!date || !editingId) return
    await supabase.from('daily_item_overrides').upsert({ item_id: editingId, active_on: date }, { onConflict: 'item_id,active_on' })
    setNewScheduleDate(''); fetchItems()
  }

  async function removeScheduledDate(date) {
    if (!editingId) return
    await supabase.from('daily_item_overrides').delete().eq('item_id', editingId).eq('active_on', date)
    fetchItems()
  }

  function toggleDay(day) {
    setForm(f => ({ ...f, recurrence_days: f.recurrence_days.includes(day) ? f.recurrence_days.filter(d => d !== day) : [...f.recurrence_days, day] }))
  }

  function recurrenceMeta(item) {
    const rule = item.recurrence_rule
    if (rule.type === 'daily') return 'Every day'
    if (rule.type === 'weekly') return DAY_LABELS.filter((_, i) => rule.days?.includes(i)).join(', ')
    if (rule.type === 'occasional') {
      const dates = futureOverridesByItem[item.id]
      if (dates?.length) return dates.map(d => { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }).join(', ')
      return 'Occasional (no upcoming dates)'
    }
    if (rule.type === 'once') {
      const [y, m, d] = rule.date.split('-').map(Number)
      return `Once: ${new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
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
    if (filterRecurrence === 'future-oneoffs') return type === 'occasional' && item.active && (futureOverridesByItem[item.id]?.length > 0)
    if (filterRecurrence === 'once') return type === 'once' && item.active
    if (filterRecurrence === 'everything') return true
    // default 'all': hide one-time items — they're not part of the recurring template
    return type !== 'once'
  })
  const activeFiltered = filtered.filter(i => i.active)
  const inactiveFiltered = filtered.filter(i => !i.active)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" ref={modalRef} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Template</h2>
          <div className="manager-pane-tabs">
            <button className={`manager-pane-tab ${activePane === 'items' ? 'active' : ''}`} onClick={() => setActivePane('items')}>Items</button>
            <button className={`manager-pane-tab ${activePane === 'schedule' ? 'active' : ''}`} onClick={() => setActivePane('schedule')}>Schedule</button>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {activePane === 'schedule' ? (
          <SchedulePane
            sections={sections}
            schedule={schedule || {}}
            onUpdateDayTags={onUpdateDayTags}
            onUpdateSectionTags={onUpdateSectionTags}
          />
        ) : (
          <>
            <div className="manager-form">
              <h3>{editingId ? 'Edit Item' : 'Add New Item'}</h3>
              {editingId && (() => {
                const editingItem = items.find(i => i.id === editingId)
                return editingItem ? (
                  <div className="edit-item-quick-actions">
                    <button className="btn-small btn-danger" onClick={() => { deleteItem(editingItem); cancelEdit() }}>Delete permanently</button>
                    <button className="btn-small" onClick={() => { toggleActive(editingItem); cancelEdit() }}>{editingItem.active ? 'Deactivate' : 'Reactivate'}</button>
                  </div>
                ) : null
              })()}
              <input className="form-input" placeholder="Item text" value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))} />
              <select className="form-input" value={form.section} onChange={e => setForm(f => ({ ...f, section: e.target.value }))}>
                {SECTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <div className="recurrence-row">
                {[['daily','Every day'],['weekly','Specific days'],['occasional','Occasional']].map(([val, lbl]) => (
                  <label key={val}>
                    <input type="radio" name="rec" value={val} checked={form.recurrence_type === val} onChange={() => setForm(f => ({ ...f, recurrence_type: val }))} />
                    {' '}{lbl}
                  </label>
                ))}
              </div>
              {form.recurrence_type === 'weekly' && (
                <div className="day-picker">
                  {DAY_LABELS.map((label, i) => (
                    <button key={i} type="button" className={`day-btn ${form.recurrence_days.includes(i) ? 'selected' : ''}`} onClick={() => toggleDay(i)}>{label}</button>
                  ))}
                </div>
              )}
              {form.recurrence_type === 'occasional' && editingId && (
                <div className="scheduled-dates">
                  <p className="scheduled-dates-label">Scheduled dates</p>
                  {!(futureOverridesByItem[editingId]?.length) ? (
                    <p className="scheduled-dates-empty">No upcoming dates scheduled.</p>
                  ) : (
                    <div className="scheduled-dates-list">
                      {(futureOverridesByItem[editingId] || []).map(d => {
                        const [y, mo, dd] = d.split('-').map(Number)
                        return (
                          <div key={d} className="scheduled-date-chip">
                            <span>{new Date(y, mo - 1, dd).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                            <button onClick={() => removeScheduledDate(d)}>✕</button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <div className="scheduled-date-add">
                    <input type="date" className="form-input" value={newScheduleDate} min={todayLocal()} onChange={e => setNewScheduleDate(e.target.value)} />
                    <button className="btn-primary" onClick={() => addScheduledDate(newScheduleDate)} disabled={!newScheduleDate}>Add date</button>
                  </div>
                </div>
              )}
              <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
                {editingId && <button className="btn-secondary" onClick={cancelEdit}>Cancel</button>}
                <button className="btn-primary" onClick={saveItem} disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Item'}</button>
              </div>
            </div>

            <div className="manager-filter">
              <input className="form-input" placeholder="Search items…" value={search} onChange={e => setSearch(e.target.value)} />
              <select className="form-input" value={filterSection} onChange={e => setFilterSection(e.target.value)}>
                <option value="all">All sections</option>
                {SECTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <select className="form-input" value={filterRecurrence} onChange={e => setFilterRecurrence(e.target.value)}>
                <option value="all">All types</option>
                <option value="daily">Daily</option>
                <option value="weekly">Specific days</option>
                <option value="occasional">Occasional</option>
                <option value="once">One-time items</option>
                <option value="future-oneoffs">Upcoming one-offs</option>
              </select>
              <button className={`btn-small ${selectMode ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setSelectMode(m => !m); setSelectedIds(new Set()) }}>
                {selectMode ? 'Cancel' : 'Select'}
              </button>
            </div>

            {selectMode && (
              <div className="bulk-action-bar">
                <label className="bulk-select-all">
                  <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} />
                  {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
                </label>
                <button className="btn-small btn-danger" onClick={deleteSelected} disabled={selectedIds.size === 0}>
                  Delete {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
                </button>
              </div>
            )}

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
                        : <div className="item-list">{secActive.map(item => <ItemRow key={item.id} item={item} sectionLabel={sectionLabel} recurrenceMeta={recurrenceMeta} onEdit={startEdit} onToggleActive={toggleActive} onDelete={deleteItem} onConvertToSection={convertToSection} selectMode={selectMode} selected={selectedIds.has(item.id)} onSelect={toggleSelect} />)}</div>
                      }
                    </div>
                  )
                })}
                {inactiveFiltered.length > 0 && (
                  <div className="deactivated-section">
                    <div className="deactivated-header">Deactivated</div>
                    <div className="item-list">{inactiveFiltered.map(item => <ItemRow key={item.id} item={item} sectionLabel={sectionLabel} recurrenceMeta={recurrenceMeta} onEdit={startEdit} onToggleActive={toggleActive} onDelete={deleteItem} onConvertToSection={convertToSection} selectMode={selectMode} selected={selectedIds.has(item.id)} onSelect={toggleSelect} />)}</div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
