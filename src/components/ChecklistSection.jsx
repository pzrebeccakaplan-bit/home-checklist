import { useState, useEffect, useRef } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../lib/supabase'

function SortableChecklistItem({ item, completion, onToggle, onEdit, onSkip, onConvertToSection, onSaved, viewDate, readOnly }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data: { sectionId: item.section },
  })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }
  const isChecked = !!completion
  const checkedBy = completion?.profile?.display_name
  const [editingText, setEditingText] = useState(false)
  const [optimisticText, setOptimisticText] = useState(null)
  const displayText = optimisticText ?? item.displayText ?? item.text
  const [text, setText] = useState(displayText)
  const inputRef = useRef(null)

  useEffect(() => {
    if (item.displayText !== undefined) {
      setOptimisticText(null)
      setText(item.displayText)
    } else if (!optimisticText) {
      setText(item.text)
    }
  }, [item.displayText, item.text]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (editingText) inputRef.current?.select() }, [editingText])

  async function saveText() {
    setEditingText(false)
    const trimmed = text.trim()
    if (!trimmed || trimmed === displayText) { setText(displayText); return }
    setOptimisticText(trimmed)
    const { error } = await supabase.from('daily_item_text_overrides').upsert(
      { item_id: item.id, override_on: viewDate, display_text: trimmed },
      { onConflict: 'item_id,override_on' }
    )
    if (error) {
      console.error('Text override save failed:', error)
      setOptimisticText(null)
      setText(item.displayText ?? item.text)
    }
  }

  return (
    <div ref={setNodeRef} style={style} className="checklist-item-row">
      {!readOnly && (
        <button className="drag-handle" {...attributes} {...listeners} aria-label="Drag to reorder">⠿</button>
      )}
      <button
        className={`item-check-btn ${isChecked ? 'checked' : ''} ${readOnly ? 'read-only' : ''}`}
        onClick={() => !readOnly && onToggle(item)}
        disabled={readOnly}
        aria-pressed={isChecked}
      >
        <span className="check-box">{isChecked ? '✓' : ''}</span>
      </button>
      <div className={`item-body ${isChecked ? 'checked' : ''} ${readOnly ? 'read-only' : ''}`}>
        {editingText ? (
          <input
            ref={inputRef}
            className="item-name-input"
            value={text}
            onChange={e => setText(e.target.value)}
            onBlur={saveText}
            onKeyDown={e => {
              if (e.key === 'Enter') saveText()
              if (e.key === 'Escape') { setEditingText(false); setText(optimisticText ?? item.displayText ?? item.text) }
            }}
          />
        ) : (
          <span
            className={`item-text ${displayText !== item.text ? 'text-overridden' : ''}`}
            onClick={() => !readOnly && setEditingText(true)}
          >{displayText}</span>
        )}
        {isChecked && checkedBy && <span className="checked-by">{checkedBy}</span>}
      </div>
      {!readOnly && (
        <>
          <button
            className="item-skip-btn"
            onClick={() => onSkip?.(item.id)}
            aria-label="Remove from today's list"
            title="Remove from today"
          >✕</button>
          <button
            className="item-template-btn"
            onClick={() => onEdit(item)}
            aria-label="Edit in template"
            title="Edit in template"
          >✎</button>
          <button
            className="item-convert-btn"
            onClick={() => onConvertToSection?.(item)}
            aria-label="Convert to section"
            title="Convert to section"
          >§</button>
        </>
      )}
    </div>
  )
}

export function ChecklistSection({ section, label, items, completions, onToggle, onEdit, onSkip, onDelete, onItemAdded, onSectionAdded, currentRole, viewDate, sectionSortOrder, prevSectionSortOrder, prevSectionId, nextSectionId, onMoveUp, onMoveDown }) {
  const [editingLabel, setEditingLabel] = useState(false)
  const [labelText, setLabelText] = useState(label)
  const labelInputRef = useRef(null)
  useEffect(() => { if (editingLabel) labelInputRef.current?.select() }, [editingLabel])
  useEffect(() => { setLabelText(label) }, [label])

  async function saveLabel() {
    setEditingLabel(false)
    const trimmed = labelText.trim()
    if (!trimmed || trimmed === label) { setLabelText(label); return }
    await supabase.from('sections').update({ label: trimmed }).eq('id', section)
    onSectionAdded?.()
  }

  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickText, setQuickText] = useState('')
  const [quickRec, setQuickRec] = useState('daily')
  const [quickDays, setQuickDays] = useState([])
  const [quickDate, setQuickDate] = useState(viewDate || '')
  const [saving, setSaving] = useState(false)

  // Make the section itself droppable so items can be dragged onto empty sections
  const { setNodeRef } = useDroppable({ id: section, data: { type: 'section', sectionId: section } })

  async function handleSkipSection() {
    if (items.length === 0) return
    if (!confirm(`Remove all "${label}" items from today's list?`)) return
    await Promise.all(
      items.map(item => supabase.from('daily_item_skips').insert({ item_id: item.id, skip_on: viewDate }))
    )
    onItemAdded?.()
  }

  async function handleConvertSectionToItem() {
    if (!nextSectionId) { alert('Cannot convert the last section — there is no section below it to receive its items.'); return }
    if (!confirm(`Convert "${label}" back to an item? All its items will move to the section below.`)) return
    const { data: nextItems } = await supabase
      .from('checklist_items').select('sort_order').eq('section', nextSectionId)
      .order('sort_order', { ascending: true }).limit(1)
    const minOrder = nextItems?.[0]?.sort_order ?? 10
    await supabase.from('checklist_items').insert({
      text: label, section: nextSectionId,
      recurrence_rule: { type: 'daily' }, active: true, sort_order: minOrder - 5,
    })
    await supabase.from('checklist_items').update({ section: nextSectionId }).eq('section', section)
    await supabase.from('sections').delete().eq('id', section)
    onSectionAdded?.()
    onItemAdded?.()
  }

  async function handleConvertToSection(item) {
    if (!confirm(`Convert "${item.text}" into a new section above "${label}"?`)) return
    const slug = item.text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
    const newSortOrder = prevSectionSortOrder != null
      ? (prevSectionSortOrder + sectionSortOrder) / 2
      : sectionSortOrder - 5
    await supabase.from('sections').insert({ id: slug, label: item.text, sort_order: newSortOrder })
    await supabase.from('checklist_items').delete().eq('id', item.id)
    onSectionAdded?.()
    onItemAdded?.()
  }

  async function submitQuickAdd(e) {
    e?.preventDefault()
    if (!quickText.trim()) return
    setSaving(true)
    const maxOrder = Math.max(0, ...items.map(i => i.sort_order))

    if (quickRec === 'once') {
      const { data: newItem } = await supabase.from('checklist_items').insert({
        text: quickText.trim(),
        section,
        recurrence_rule: { type: 'occasional' },
        active: true,
        sort_order: maxOrder + 10,
      }).select().single()
      if (newItem && quickDate) {
        await supabase.from('daily_item_overrides').insert({ item_id: newItem.id, active_on: quickDate })
      }
    } else {
      const rule = quickRec === 'weekly'
        ? { type: 'weekly', days: quickDays }
        : { type: quickRec }
      await supabase.from('checklist_items').insert({
        text: quickText.trim(),
        section,
        recurrence_rule: rule,
        active: true,
        sort_order: maxOrder + 10,
      })
    }

    setQuickText('')
    setQuickRec('daily')
    setQuickDays([])
    setQuickDate(viewDate || '')
    setShowQuickAdd(false)
    setSaving(false)
    onItemAdded?.()
  }

  function toggleQuickDay(day) {
    setQuickDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

  if (items.length === 0 && !showQuickAdd) return (
    <section className="checklist-section">
      <h2 className="section-header">
        {onMoveUp && <button className="section-move-btn" onClick={onMoveUp} aria-label="Move section up">↑</button>}
        {onMoveDown && <button className="section-move-btn" onClick={onMoveDown} aria-label="Move section down">↓</button>}
        <span className="section-label" onClick={() => setEditingLabel(true)}>{label}</span>
        <span className="section-header-actions">
          <button className="section-action-btn" onClick={handleConvertSectionToItem} title="Convert section back to item">↩ item</button>
        </span>
      </h2>
      <button className="quick-add-trigger" onClick={() => setShowQuickAdd(true)}>+ Add item</button>
    </section>
  )

  return (
    <section className="checklist-section">
      <h2 className="section-header">
        {onMoveUp && <button className="section-move-btn" onClick={onMoveUp} aria-label="Move section up">↑</button>}
        {onMoveDown && <button className="section-move-btn" onClick={onMoveDown} aria-label="Move section down">↓</button>}
        {editingLabel ? (
          <input
            ref={labelInputRef}
            className="section-label-input"
            value={labelText}
            onChange={e => setLabelText(e.target.value)}
            onBlur={saveLabel}
            onKeyDown={e => {
              if (e.key === 'Enter') saveLabel()
              if (e.key === 'Escape') { setEditingLabel(false); setLabelText(label) }
            }}
          />
        ) : (
          <span className="section-label" onClick={() => setEditingLabel(true)} title="Click to rename">{label}</span>
        )}
        <span className="section-header-actions">
          {items.length > 0 && (
            <button className="section-action-btn" onClick={handleSkipSection} title="Remove section from today">✕ today</button>
          )}
          <button className="section-action-btn" onClick={handleConvertSectionToItem} title="Convert section back to item">↩ item</button>
        </span>
      </h2>

      <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
        <div className="section-items" ref={setNodeRef}>
          {items.map(item => (
            <SortableChecklistItem
              key={item.id}
              item={item}
              completion={completions[item.id]}
              onToggle={onToggle}
              onEdit={onEdit}
              onSkip={onSkip}
              onConvertToSection={handleConvertToSection}
              onSaved={onItemAdded}
              viewDate={viewDate}
              readOnly={false}
            />
          ))}
        </div>
      </SortableContext>

      {showQuickAdd ? (
        <form className="quick-add-form" onSubmit={submitQuickAdd}>
          <input
            autoFocus
            className="quick-add-input"
            placeholder="New item…"
            value={quickText}
            onChange={e => setQuickText(e.target.value)}
          />
          <div className="quick-add-rec">
            {[
              { value: 'daily', label: 'Every day' },
              { value: 'weekly', label: 'Specific days' },
              { value: 'occasional', label: 'Occasional' },
              { value: 'once', label: 'One-time date' },
            ].map(({ value, label }) => (
              <label key={value}>
                <input type="radio" name={`rec-${section}`} value={value}
                  checked={quickRec === value}
                  onChange={() => setQuickRec(value)} />
                {' '}{label}
              </label>
            ))}
          </div>
          {quickRec === 'weekly' && (
            <div className="day-picker">
              {DAY_LABELS.map((d, i) => (
                <button key={i} type="button"
                  className={`day-btn ${quickDays.includes(i) ? 'selected' : ''}`}
                  onClick={() => toggleQuickDay(i)}>{d}</button>
              ))}
            </div>
          )}
          {quickRec === 'once' && (
            <input
              type="date"
              className="form-input"
              value={quickDate}
              onChange={e => setQuickDate(e.target.value)}
              min={viewDate}
            />
          )}
          <div className="quick-add-actions">
            <button type="button" className="btn-secondary" onClick={() => { setShowQuickAdd(false); setQuickText('') }}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving || !quickText.trim() || (quickRec === 'once' && !quickDate)}>
              {saving ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      ) : (
        <button className="quick-add-trigger" onClick={() => setShowQuickAdd(true)}>+ Add item</button>
      )}
    </section>
  )
}
