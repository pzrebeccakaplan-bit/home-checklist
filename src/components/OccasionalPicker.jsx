import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const SECTION_LABELS = {
  morning_shared:    'Morning — Everyone',
  morning_rebecca:   "Rebecca's Morning",
  morning_pz:        "PZ's Morning",
  evening_shared:    'Evening — Everyone',
  evening_rebecca:   "Rebecca's Evening",
  evening_pz:        "PZ's Evening",
  before_bed_discuss:'Before Bed — Discuss Together',
  last_to_bed:       'Last One to Bed',
}

export function OccasionalPicker({ occasionalActive, onToggle, onClose }) {
  const [allOccasional, setAllOccasional] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
  }, [])

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
          <h2>Add Items for Today</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <p className="modal-subtitle">
          These items don't appear automatically. Toggle the ones you need today.
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
                    <button
                      key={item.id}
                      className={`picker-item ${isActive ? 'active' : ''}`}
                      onClick={() => onToggle(item.id)}
                    >
                      <span className="check-box">{isActive ? '✓' : ''}</span>
                      {item.text}
                    </button>
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
