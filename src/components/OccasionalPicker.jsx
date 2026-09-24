import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export function OccasionalPicker({ sections, occasionalActive, onToggle, onClose, viewDate, onEdit }) {
  const SECTION_LABELS = Object.fromEntries(sections.map(s => [s.id, s.label]))
  const [allOccasional, setAllOccasional] = useState([])
  const [loading, setLoading] = useState(true)
  const editRef = useRef(null)

  function fetchItems() {
    supabase
      .from('checklist_items')
      .select('*')
      .eq('active', true)
      .filter('recurrence_rule->>type', 'eq', 'occasional')
      .order('section')
      .order('sort_order')
      .then(({ data }) => {
        setAllOccasional(data || [])
        setLoading(false)
      })
  }

  useEffect(() => { fetchItems() }, [])

  async function deleteItem(item) {
    if (!confirm(`Remove "${item.text}" from the Occasionals list?`)) return
    await supabase.from('checklist_items').update({ active: false }).eq('id', item.id)
    fetchItems()
  }

  // Group by section
  const bySection = {}
  for (const item of allOccasional) {
    if (!bySection[item.section]) bySection[item.section] = []
    bySection[item.section].push(item)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Items</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <p className="modal-subtitle">
          {(() => {
            const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()
            if (!viewDate || viewDate === todayStr) return 'Toggle occasional items to add them to today\'s list.'
            const [y, m, d] = viewDate.split('-').map(Number)
            const label = new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
            return `Toggle items to add them to ${label}.`
          })()}
        </p>
        {loading ? (
          <p>Loading…</p>
        ) : allOccasional.length === 0 ? (
          <p className="empty-state">No occasional items yet. Add some in Manage.</p>
        ) : (
          <div className="picker-sections">
            {Object.entries(bySection).map(([section, items]) => (
              <div key={section} className="picker-section">
                <h3>{SECTION_LABELS[section]}</h3>
                {items.map(item => {
                  const isActive = occasionalActive.has(item.id)
                  return (
                    <div key={item.id} className={`picker-item ${isActive ? 'active' : ''}`}>
                      <button className="picker-item-toggle" onClick={() => onToggle(item.id)}>
                        <span className="check-box">{isActive ? '✓' : ''}</span>
                      </button>
                      <span className="picker-item-text" onClick={() => onToggle(item.id)}>{item.text}</span>
                      <button className="picker-item-edit-btn" onClick={e => { e.stopPropagation(); onEdit?.(item) }} title="Edit in template">✎</button>
                      <button className="picker-item-delete-btn" onClick={e => { e.stopPropagation(); deleteItem(item) }} title="Remove from Occasionals">🗑</button>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
