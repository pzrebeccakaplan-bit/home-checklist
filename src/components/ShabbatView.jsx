import { useState, useEffect, useRef } from 'react'
import {
  DndContext, DragOverlay, closestCenter,
  PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../lib/supabase'

function SortableShabbatItem({ item, completion, onToggle }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }
  const isChecked = !!completion
  const checkedBy = completion?.profile?.display_name
  return (
    <div ref={setNodeRef} style={style} className="checklist-item-row">
      <button className="drag-handle" {...attributes} {...listeners} aria-label="Drag to reorder">⠿</button>
      <button className={`item-check-btn ${isChecked ? 'checked' : ''}`} onClick={() => onToggle(item)} aria-pressed={isChecked}>
        <span className="check-box">{isChecked ? '✓' : ''}</span>
      </button>
      <div className={`item-body ${isChecked ? 'checked' : ''}`}>
        <span className="item-text">{item.text}</span>
        {isChecked && checkedBy && <span className="checked-by">{checkedBy}</span>}
      </div>
    </div>
  )
}

export function ShabbatSection({ section, label, items, completions, onToggle, onItemAdded, onSectionAdded }) {
  const [editingLabel, setEditingLabel] = useState(false)
  const [labelText, setLabelText] = useState(label)
  const labelInputRef = useRef(null)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickText, setQuickText] = useState('')
  const [saving, setSaving] = useState(false)
  const { setNodeRef } = useDroppable({ id: `shabbat-${section}`, data: { type: 'shabbat-section', sectionId: section } })

  useEffect(() => { if (editingLabel) labelInputRef.current?.select() }, [editingLabel])
  useEffect(() => { setLabelText(label) }, [label])

  async function saveLabel() {
    setEditingLabel(false)
    const trimmed = labelText.trim()
    if (!trimmed || trimmed === label) { setLabelText(label); return }
    await supabase.from('shabbat_sections').update({ label: trimmed }).eq('id', section)
    onSectionAdded?.()
  }

  async function handleCheckAll() {
    await Promise.all(items.map(item => onToggle(item)))
  }

  async function submitQuickAdd(e) {
    e?.preventDefault()
    if (!quickText.trim()) return
    setSaving(true)
    const minOrder = items.length > 0 ? Math.min(...items.map(i => i.sort_order)) : 10
    await supabase.from('shabbat_items').insert({ text: quickText.trim(), section, sort_order: minOrder - 5, active: true })
    setQuickText('')
    setShowQuickAdd(false)
    setSaving(false)
    onItemAdded?.()
  }

  if (items.length === 0 && !showQuickAdd) return (
    <section className="checklist-section">
      <h2 className="section-header">
        <span className="section-label-group">
          <span className="section-label" onClick={() => setEditingLabel(true)}>{label}</span>
          <button className="section-add-btn" onClick={() => setShowQuickAdd(true)}>+ Add</button>
        </span>
      </h2>
    </section>
  )

  return (
    <section className="checklist-section">
      <h2 className="section-header">
        <button className="section-check-btn" onClick={handleCheckAll} title="Check all" aria-label="Check all">
          <span className="section-check-box" />
        </button>
        <span className="section-label-group">
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
          {!editingLabel && <button className="section-add-btn" onClick={() => setShowQuickAdd(true)}>+ Add</button>}
        </span>
      </h2>
      <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
        <div className="section-items" ref={setNodeRef}>
          {items.map(item => (
            <SortableShabbatItem key={item.id} item={item} completion={completions[item.id]} onToggle={onToggle} />
          ))}
        </div>
      </SortableContext>
      {showQuickAdd && (
        <form className="quick-add-form" onSubmit={submitQuickAdd}>
          <input autoFocus className="quick-add-input" placeholder="New item…" value={quickText} onChange={e => setQuickText(e.target.value)} />
          <div className="quick-add-actions">
            <button type="button" className="btn-secondary" onClick={() => { setShowQuickAdd(false); setQuickText('') }}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving || !quickText.trim()}>{saving ? 'Adding…' : 'Add'}</button>
          </div>
        </form>
      )}
    </section>
  )
}

// Panel rendered inside TodayView on Fridays — owns its own DnD context
export function ShabbatSectionsPanel({ shabbatSections, shabbatItems, shabbatCompletions, onToggleShabbat, onShabbatItemAdded, onShabbatSectionAdded }) {
  const [localItems, setLocalItems] = useState(shabbatItems)
  useEffect(() => { setLocalItems(shabbatItems) }, [shabbatItems])
  const [activeId, setActiveId] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  async function handleDragEnd({ active, over }) {
    setActiveId(null)
    if (!over || active.id === over.id) return
    const activeItem = localItems.find(i => i.id === active.id)
    if (!activeItem) return
    const overIsSection = over.data.current?.type === 'shabbat-section'
    const overItem = overIsSection ? null : localItems.find(i => i.id === over.id)
    const targetSectionId = overIsSection ? over.data.current.sectionId : overItem?.section
    if (!targetSectionId || targetSectionId !== activeItem.section) return

    const sectionItems = localItems.filter(i => i.section === activeItem.section && !shabbatCompletions[i.id])
    const oldIdx = sectionItems.findIndex(i => i.id === active.id)
    const newIdx = sectionItems.findIndex(i => i.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    const reordered = arrayMove(sectionItems, oldIdx, newIdx).map((item, idx) => ({ ...item, sort_order: (idx + 1) * 10 }))
    setLocalItems(prev => [
      ...prev.filter(i => i.section !== activeItem.section || shabbatCompletions[i.id]),
      ...reordered,
    ])
    await Promise.all(reordered.map(item =>
      supabase.from('shabbat_items').update({ sort_order: item.sort_order }).eq('id', item.id)
    ))
  }

  const bySection = {}
  const completedBySection = {}
  for (const sec of shabbatSections) { bySection[sec.id] = []; completedBySection[sec.id] = [] }
  for (const item of localItems) {
    if (shabbatCompletions[item.id]) completedBySection[item.section]?.push(item)
    else bySection[item.section]?.push(item)
  }

  const completedSections = shabbatSections.filter(s => completedBySection[s.id]?.length > 0)
  const activeItem = activeId ? localItems.find(i => i.id === activeId) : null

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={({ active }) => setActiveId(active.id)}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        {shabbatSections.map(sec => (
          <ShabbatSection
            key={sec.id}
            section={sec.id}
            label={sec.label}
            items={bySection[sec.id] || []}
            completions={shabbatCompletions}
            onToggle={onToggleShabbat}
            onItemAdded={onShabbatItemAdded}
            onSectionAdded={onShabbatSectionAdded}
          />
        ))}
        <DragOverlay>
          {activeItem && (
            <div className="drag-preview-row">
              <span className="drag-preview-text">{activeItem.text}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {completedSections.length > 0 && completedSections.map(sec => (
        <div key={sec.id} className="completed-section shabbat-completed-inline">
          <div className="completed-section-label">
            {sec.label}
            <button className="section-uncheck-all-btn" onClick={() => Promise.all(completedBySection[sec.id].map(item => onToggleShabbat(item)))}>↺ uncheck all</button>
          </div>
          {completedBySection[sec.id].map(item => (
            <button key={item.id} className="checklist-item checked completed-item" onClick={() => onToggleShabbat(item)}>
              <span className="check-box">✓</span>
              <span className="item-text">{item.text}</span>
              {shabbatCompletions[item.id]?.profile?.display_name && <span className="checked-by">{shabbatCompletions[item.id].profile.display_name}</span>}
            </button>
          ))}
        </div>
      ))}
    </>
  )
}
