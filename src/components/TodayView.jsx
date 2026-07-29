import { useState, useEffect } from 'react'
import {
  DndContext, DragOverlay, closestCenter,
  PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { supabase } from '../lib/supabase'
import { ChecklistSection } from './ChecklistSection'

export function TodayView({ sections, items, completions, onToggle, onEdit, onDelete, onSkip, onItemAdded, currentRole, onOpenPicker, onOpenManager, onSignOut, profile, onAddSection, onSectionAdded, viewDate, onPrevDay, onNextDay, onGoToday, onJumpToDate }) {
  const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()
  const isToday = viewDate === todayStr
  const [y, m, d] = viewDate.split('-').map(Number)
  const dateLabel = new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const [showNewSection, setShowNewSection] = useState(false)
  const [newSectionLabel, setNewSectionLabel] = useState('')
  const [addingSec, setAddingSec] = useState(false)

  // Local items state for optimistic DnD reordering across sections
  const [localItems, setLocalItems] = useState(items)
  useEffect(() => { setLocalItems(items) }, [items])

  // Local sections state for optimistic section reordering
  const [localSections, setLocalSections] = useState(sections)
  useEffect(() => { setLocalSections(sections) }, [sections])
  const [activeId, setActiveId] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  // Split into unchecked (localItems) and checked (items) by section
  const bySection = {}
  const completedBySection = {}
  for (const sec of localSections) {
    bySection[sec.id] = []
    completedBySection[sec.id] = []
  }
  for (const item of localItems) {
    if (!bySection[item.section]) continue
    if (completions[item.id]) completedBySection[item.section].push(item)
    else bySection[item.section].push(item)
  }

  const totalItems = items.length
  const doneCount = Object.keys(completions).filter(id => items.find(i => i.id === id)).length
  const completedSections = localSections.filter(s => completedBySection[s.id]?.length > 0)
  const activeItem = activeId ? localItems.find(i => i.id === activeId) : null

  async function handleDragEnd({ active, over }) {
    setActiveId(null)
    if (!over || active.id === over.id) return

    const activeItem = localItems.find(i => i.id === active.id)
    if (!activeItem) return

    // Determine target section: over an item → use that item's section; over a section droppable → use section id
    const overIsSection = over.data.current?.type === 'section'
    const overItem = overIsSection ? null : localItems.find(i => i.id === over.id)
    const targetSectionId = overIsSection ? over.id : (overItem?.section ?? over.data.current?.sectionId)
    if (!targetSectionId) return

    const sourceSectionId = activeItem.section

    if (sourceSectionId === targetSectionId) {
      // Same-section reorder
      const sectionItems = localItems
        .filter(i => i.section === sourceSectionId && !completions[i.id])
        .sort((a, b) => a.sort_order - b.sort_order)
      const oldIdx = sectionItems.findIndex(i => i.id === active.id)
      const newIdx = sectionItems.findIndex(i => i.id === over.id)
      if (oldIdx === -1 || newIdx === -1) return
      const reordered = arrayMove(sectionItems, oldIdx, newIdx)
      setLocalItems(prev => {
        const others = prev.filter(i => i.section !== sourceSectionId || completions[i.id])
        return [...others, ...reordered]
      })
      await Promise.all(
        reordered.map((item, idx) =>
          supabase.from('checklist_items').update({ sort_order: (idx + 1) * 10 }).eq('id', item.id)
        )
      )
    } else {
      // Cross-section move: find insertion point in target section
      const targetItems = localItems
        .filter(i => i.section === targetSectionId && i.id !== active.id && !completions[i.id])
        .sort((a, b) => a.sort_order - b.sort_order)
      const overIdx = overItem ? targetItems.findIndex(i => i.id === over.id) : targetItems.length
      const insertIdx = overIdx === -1 ? targetItems.length : overIdx
      const prev = targetItems[insertIdx - 1]
      const next = targetItems[insertIdx]
      const newSortOrder = prev && next
        ? (prev.sort_order + next.sort_order) / 2
        : prev ? prev.sort_order + 10
        : next ? next.sort_order - 5
        : 10

      setLocalItems(prevItems =>
        prevItems.map(i => i.id === active.id ? { ...i, section: targetSectionId, sort_order: newSortOrder } : i)
      )
      await supabase.from('checklist_items')
        .update({ section: targetSectionId, sort_order: newSortOrder })
        .eq('id', active.id)
      onItemAdded?.()
    }
  }

  async function moveSectionBy(sectionId, delta) {
    const idx = localSections.findIndex(s => s.id === sectionId)
    const newIdx = idx + delta
    if (newIdx < 0 || newIdx >= localSections.length) return
    const reordered = arrayMove(localSections, idx, newIdx)
    setLocalSections(reordered)
    await Promise.all(
      reordered.map((sec, i) =>
        supabase.from('sections').update({ sort_order: (i + 1) * 10 }).eq('id', sec.id)
      )
    )
    onSectionAdded?.()
  }

  async function submitNewSection(e) {
    e?.preventDefault()
    if (!newSectionLabel.trim()) return
    setAddingSec(true)
    await onAddSection(newSectionLabel)
    setNewSectionLabel('')
    setShowNewSection(false)
    setAddingSec(false)
  }

  return (
    <div className="today-view">
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title">Home Checklist</h1>
          <div className="date-nav">
            <button className="date-nav-btn" onClick={onPrevDay} aria-label="Previous day">‹</button>
            <input
              type="date"
              className="date-jump-input"
              value={viewDate}
              onChange={e => e.target.value && onJumpToDate(e.target.value)}
              aria-label="Jump to date"
            />
            <button className="date-nav-btn" onClick={onNextDay} aria-label="Next day">›</button>
            {!isToday && (
              <button className="today-jump-btn" onClick={onGoToday}>Today</button>
            )}
          </div>
        </div>
        <div className="header-right">
          <span className="progress-badge">{doneCount}/{totalItems}</span>
          <button className="header-btn" onClick={onOpenPicker}>Add Occasional Items</button>
          <button className="header-btn" onClick={onOpenManager}>Manage Template</button>
          <button className="header-btn secondary" onClick={onSignOut}>
            {profile?.display_name || 'Sign out'}
          </button>
        </div>
      </header>

      <main className="sections-container">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={({ active }) => setActiveId(active.id)}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          {localSections.map((sec, idx) => (
            <ChecklistSection
              key={sec.id}
              section={sec.id}
              label={sec.label}
              items={bySection[sec.id] || []}
              completions={completions}
              onToggle={onToggle}
              onEdit={onEdit}
              onSkip={onSkip}
              onDelete={onDelete}
              onItemAdded={onItemAdded}
              onSectionAdded={onSectionAdded}
              currentRole={currentRole}
              viewDate={viewDate}
              sectionSortOrder={sec.sort_order}
              prevSectionSortOrder={idx > 0 ? sections[idx - 1].sort_order : null}
              prevSectionId={idx > 0 ? localSections[idx - 1].id : null}
              nextSectionId={idx < localSections.length - 1 ? localSections[idx + 1].id : null}
              onMoveUp={idx > 0 ? () => moveSectionBy(sec.id, -1) : null}
              onMoveDown={idx < localSections.length - 1 ? () => moveSectionBy(sec.id, 1) : null}
            />
          ))}

          <DragOverlay>
            {activeItem && (
              <div className="drag-preview-row">
                <span className="drag-preview-text">{activeItem.displayText ?? activeItem.text}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>

        {/* New Section button */}
        {showNewSection ? (
          <form className="new-section-form" onSubmit={submitNewSection}>
            <input
              autoFocus
              className="form-input"
              placeholder="Section name (e.g. Afternoon)"
              value={newSectionLabel}
              onChange={e => setNewSectionLabel(e.target.value)}
            />
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => { setShowNewSection(false); setNewSectionLabel('') }}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={addingSec || !newSectionLabel.trim()}>
                {addingSec ? 'Creating…' : 'Create Section'}
              </button>
            </div>
          </form>
        ) : (
          <button className="new-section-btn" onClick={() => setShowNewSection(true)}>
            + New Section
          </button>
        )}

        {/* Completed items at bottom */}
        {completedSections.length > 0 && (
          <div className="completed-area">
            <div className="completed-area-header">Completed</div>
            {completedSections.map(sec => (
              <div key={sec.id} className="completed-section">
                <div className="completed-section-label">{sec.label}</div>
                {completedBySection[sec.id].map(item => {
                  const completion = completions[item.id]
                  const checkedBy = completion?.profile?.display_name
                  return (
                    <button
                      key={item.id}
                      className="checklist-item checked completed-item"
                      onClick={() => onToggle(item)}
                    >
                      <span className="check-box">✓</span>
                      <span className="item-text">{item.text}</span>
                      {checkedBy && <span className="checked-by">{checkedBy}</span>}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
