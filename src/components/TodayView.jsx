import { useState, useEffect, useRef } from 'react'
import {
  DndContext, DragOverlay, closestCenter,
  PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { supabase } from '../lib/supabase'
import { ChecklistSection } from './ChecklistSection'

function UnassignedItem({ item, sections, completion, onToggle, onAssigned }) {
  const [assigning, setAssigning] = useState(false)
  const selectRef = useRef(null)
  const isChecked = !!completion
  const checkedBy = completion?.profile?.display_name

  async function assign(sectionId) {
    if (!sectionId) return
    await supabase.from('checklist_items').update({ section: sectionId }).eq('id', item.id)
    onAssigned?.()
  }

  return (
    <div className="checklist-item-row">
      <button className={`item-check-btn ${isChecked ? 'checked' : ''}`} onClick={() => onToggle(item)} aria-pressed={isChecked}>
        <span className="check-box">{isChecked ? '✓' : ''}</span>
      </button>
      <div className={`item-body ${isChecked ? 'checked' : ''}`}>
        <span className="item-text">{item.displayText ?? item.text}</span>
        {isChecked && checkedBy && <span className="checked-by">{checkedBy}</span>}
      </div>
      {assigning ? (
        <select
          ref={selectRef}
          autoFocus
          className="assign-section-select"
          defaultValue=""
          onChange={e => { assign(e.target.value); setAssigning(false) }}
          onBlur={() => setAssigning(false)}
        >
          <option value="" disabled>Assign to…</option>
          {sections.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      ) : (
        <button className="item-assign-btn" onClick={() => setAssigning(true)} title="Assign to section">assign</button>
      )}
    </div>
  )
}

export function TodayView({ sections, items, completions, onToggle, onEdit, onDelete, onSkip, onItemAdded, currentRole, onOpenPicker, onOpenManager, onSignOut, profile, onAddSection, onSectionAdded, viewDate, onPrevDay, onNextDay, onGoToday, onJumpToDate }) {
  const todayStr = (() => { const d = new Date(); if (d.getHours() < 5) d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()
  const isToday = viewDate === todayStr
  const [y, m, d] = viewDate.split('-').map(Number)
  const dateLabel = new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const [completedQuickAdd, setCompletedQuickAdd] = useState(null)
  const [completedQuickText, setCompletedQuickText] = useState('')
  const [completedQuickRec, setCompletedQuickRec] = useState('once')
  const [completedQuickDays, setCompletedQuickDays] = useState([])
  const [completedQuickDate, setCompletedQuickDate] = useState(viewDate)
  const [completedQuickSaving, setCompletedQuickSaving] = useState(false)
  const [showNewSection, setShowNewSection] = useState(false)
  const [newSectionLabel, setNewSectionLabel] = useState('')
  const [addingSec, setAddingSec] = useState(false)
  const [undoAction, setUndoAction] = useState(null)
  const undoTimer = useRef(null)

  function pushUndo(label, fn) {
    clearTimeout(undoTimer.current)
    setUndoAction({ label, fn })
    undoTimer.current = setTimeout(() => setUndoAction(null), 8000)
  }

  function executeUndo() {
    clearTimeout(undoTimer.current)
    undoAction?.fn()
    setUndoAction(null)
  }

  function handleToggle(item) {
    const wasChecked = !!completions[item.id]
    onToggle(item)
    pushUndo(
      wasChecked ? `Unchecked "${item.displayText ?? item.text}"` : `Checked "${item.displayText ?? item.text}"`,
      () => onToggle(item)
    )
  }

  function handleSkip(itemId) {
    const item = items.find(i => i.id === itemId)
    onSkip(itemId)
    pushUndo(`Removed "${item?.displayText ?? item?.text}"`, async () => {
      await supabase.from('daily_item_skips').delete().eq('item_id', itemId).eq('skip_on', viewDate)
      onItemAdded?.()
    })
  }

  async function handleSkipSection(sectionId, sectionLabel, sectionItems) {
    if (!sectionItems.length) return
    if (!confirm(`Remove all "${sectionLabel}" items from today's list?`)) return
    await Promise.all(sectionItems.map(item =>
      supabase.from('daily_item_skips').insert({ item_id: item.id, skip_on: viewDate })
    ))
    onItemAdded?.()
    pushUndo(`Removed "${sectionLabel}" section`, async () => {
      await Promise.all(sectionItems.map(item =>
        supabase.from('daily_item_skips').delete().eq('item_id', item.id).eq('skip_on', viewDate)
      ))
      onItemAdded?.()
    })
  }

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

  const knownSectionIds = new Set(localSections.map(s => s.id))
  const orphanedItems = localItems.filter(i => !knownSectionIds.has(i.section) && !completions[i.id])
  const orphanedCompleted = localItems.filter(i => !knownSectionIds.has(i.section) && completions[i.id])
  const visibleItems = localItems.filter(i => knownSectionIds.has(i.section))
  const totalItems = visibleItems.length + orphanedItems.length + orphanedCompleted.length
  const doneCount = visibleItems.filter(i => completions[i.id]).length + orphanedCompleted.length
  const completedSections = localSections.filter(s => completedBySection[s.id]?.length > 0)
  const activeItem = activeId ? localItems.find(i => i.id === activeId) : null

  async function handleDragEnd({ active, over }) {
    setActiveId(null)
    if (!over || active.id === over.id) return

    const activeItem = localItems.find(i => i.id === active.id)
    if (!activeItem) return

    const overIsSection = over.data.current?.type === 'section'
    const overItem = overIsSection ? null : localItems.find(i => i.id === over.id)
    const targetSectionId = overIsSection ? over.id : (overItem?.section ?? over.data.current?.sectionId)
    if (!targetSectionId) return

    const sourceSectionId = activeItem.section

    if (sourceSectionId === targetSectionId) {
      // Use localItems order directly — don't re-sort by sort_order, which would revert to DB order
      const sectionItems = localItems.filter(i => i.section === sourceSectionId && !completions[i.id])
      const oldIdx = sectionItems.findIndex(i => i.id === active.id)
      const newIdx = sectionItems.findIndex(i => i.id === over.id)
      if (oldIdx === -1 || newIdx === -1) return
      // Assign updated sort_orders immediately so subsequent drags use the correct baseline
      const reordered = arrayMove(sectionItems, oldIdx, newIdx).map((item, idx) => ({
        ...item, sort_order: (idx + 1) * 10,
      }))
      setLocalItems(prev => [
        ...prev.filter(i => i.section !== sourceSectionId || completions[i.id]),
        ...reordered,
      ])
      await Promise.all(
        reordered.map(item =>
          supabase.from('checklist_items').update({ sort_order: item.sort_order }).eq('id', item.id)
        )
      )
    } else {
      // Use localItems order for target section — don't re-sort by sort_order
      const targetItems = localItems.filter(i => i.section === targetSectionId && i.id !== active.id && !completions[i.id])
      const overIdx = overItem ? targetItems.findIndex(i => i.id === over.id) : targetItems.length
      const insertIdx = overIdx === -1 ? targetItems.length : overIdx
      const prevItem = targetItems[insertIdx - 1]
      const nextItem = targetItems[insertIdx]
      const newSortOrder = prevItem && nextItem
        ? (prevItem.sort_order + nextItem.sort_order) / 2
        : prevItem ? prevItem.sort_order + 10
        : nextItem ? nextItem.sort_order - 5
        : 10

      setLocalItems(prev =>
        prev.map(i => i.id === active.id ? { ...i, section: targetSectionId, sort_order: newSortOrder } : i)
      )
      // Fire-and-forget — don't call onItemAdded/refetch here, which would reset localItems
      supabase.from('checklist_items')
        .update({ section: targetSectionId, sort_order: newSortOrder })
        .eq('id', active.id)
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

  const DAY_LABELS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

  async function submitCompletedQuickAdd(sectionId, e) {
    e?.preventDefault()
    if (!completedQuickText.trim()) return
    if (completedQuickRec === 'once' && !completedQuickDate) return
    setCompletedQuickSaving(true)
    const sectionItems = localItems.filter(i => i.section === sectionId)
    const minOrder = sectionItems.length > 0 ? Math.min(...sectionItems.map(i => i.sort_order)) : 10
    const rule = completedQuickRec === 'weekly'
      ? { type: 'weekly', days: completedQuickDays }
      : completedQuickRec === 'once'
        ? { type: 'occasional' }
        : { type: completedQuickRec }
    const { data: newItem } = await supabase.from('checklist_items').insert({
      text: completedQuickText.trim(),
      section: sectionId,
      recurrence_rule: rule,
      active: true,
      sort_order: minOrder - 5,
    }).select().single()
    if (completedQuickRec === 'once' && newItem) {
      await supabase.from('daily_item_overrides').insert({ item_id: newItem.id, active_on: completedQuickDate })
    }
    setCompletedQuickText('')
    setCompletedQuickRec('once')
    setCompletedQuickDays([])
    setCompletedQuickDate(viewDate)
    setCompletedQuickAdd(null)
    setCompletedQuickSaving(false)
    onItemAdded?.()
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
          <button className="header-btn" onClick={onOpenPicker}>Occasional</button>
          <button className="header-btn" onClick={onOpenManager}>Template</button>
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
          {localSections.map((sec, idx) => {
            if (!bySection[sec.id]?.length) return null
            return <ChecklistSection
              key={sec.id}
              section={sec.id}
              label={sec.label}
              items={bySection[sec.id] || []}
              completedItems={completedBySection[sec.id] || []}
              completions={completions}
              onToggle={handleToggle}
              onEdit={onEdit}
              onSkip={handleSkip}
              onSkipSection={handleSkipSection}
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
          })}

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

        {/* Unassigned items (section deleted/missing) */}
        {(orphanedItems.length > 0 || orphanedCompleted.length > 0) && (
          <div className="checklist-section">
            <h2 className="section-header">
              <span className="section-label-group"><span className="section-label">Unassigned</span></span>
            </h2>
            <div className="section-items">
              {[...orphanedItems, ...orphanedCompleted].map(item => (
                <UnassignedItem
                  key={item.id}
                  item={item}
                  sections={localSections}
                  completion={completions[item.id]}
                  onToggle={handleToggle}
                  onAssigned={onItemAdded}
                />
              ))}
            </div>
          </div>
        )}

        {/* Completed items at bottom */}
        {completedSections.length > 0 && (
          <div className="completed-area">
            <div className="completed-area-header">Completed</div>
            {completedSections.map(sec => (
              <div key={sec.id} className="completed-section">
                <div className="completed-section-label">
                  {sec.label}
                  <button className="section-uncheck-all-btn" onClick={() => Promise.all(completedBySection[sec.id].map(item => handleToggle(item)))} title="Uncheck all">↺ uncheck all</button>
                  {completedQuickAdd !== sec.id && (
                    <button className="section-add-btn" onClick={() => { setCompletedQuickAdd(sec.id); setCompletedQuickText('') }}>+ Add</button>
                  )}
                </div>
                {completedBySection[sec.id].map(item => {
                  const completion = completions[item.id]
                  const checkedBy = completion?.profile?.display_name
                  return (
                    <button
                      key={item.id}
                      className="checklist-item checked completed-item"
                      onClick={() => handleToggle(item)}
                    >
                      <span className="check-box">✓</span>
                      <span className="item-text">{item.text}</span>
                      {checkedBy && <span className="checked-by">{checkedBy}</span>}
                    </button>
                  )
                })}
                {completedQuickAdd === sec.id && (
                  <form className="completed-quick-add" onSubmit={e => submitCompletedQuickAdd(sec.id, e)}>
                    <input
                      autoFocus
                      className="quick-add-input"
                      placeholder="New item…"
                      value={completedQuickText}
                      onChange={e => setCompletedQuickText(e.target.value)}
                    />
                    <div className="quick-add-rec">
                      {[
                        { value: 'once', label: 'One-time' },
                        { value: 'daily', label: 'Every day' },
                        { value: 'weekly', label: 'Specific days' },
                        { value: 'occasional', label: 'Occasional' },
                      ].map(({ value, label }) => (
                        <label key={value}>
                          <input type="radio" name={`crec-${sec.id}`} value={value}
                            checked={completedQuickRec === value}
                            onChange={() => setCompletedQuickRec(value)} />
                          {' '}{label}
                        </label>
                      ))}
                    </div>
                    {completedQuickRec === 'weekly' && (
                      <div className="day-picker">
                        {DAY_LABELS_SHORT.map((d, i) => (
                          <button key={i} type="button"
                            className={`day-btn ${completedQuickDays.includes(i) ? 'selected' : ''}`}
                            onClick={() => setCompletedQuickDays(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}>
                            {d}
                          </button>
                        ))}
                      </div>
                    )}
                    {completedQuickRec === 'once' && (
                      <input type="date" className="form-input" value={completedQuickDate}
                        onChange={e => setCompletedQuickDate(e.target.value)} />
                    )}
                    <div className="quick-add-actions">
                      <button type="button" className="btn-secondary" onClick={() => { setCompletedQuickAdd(null); setCompletedQuickText(''); setCompletedQuickRec('once'); setCompletedQuickDays([]); setCompletedQuickDate(viewDate) }}>Cancel</button>
                      <button type="submit" className="btn-primary" disabled={completedQuickSaving || !completedQuickText.trim() || (completedQuickRec === 'once' && !completedQuickDate)}>
                        {completedQuickSaving ? 'Adding…' : 'Add'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      {undoAction && (
        <div className="undo-toast">
          <span className="undo-toast-label">{undoAction.label}</span>
          <button className="undo-toast-btn" onClick={executeUndo}>Undo</button>
          <button className="undo-toast-dismiss" onClick={() => { clearTimeout(undoTimer.current); setUndoAction(null) }}>✕</button>
        </div>
      )}
      </main>
    </div>
  )
}
