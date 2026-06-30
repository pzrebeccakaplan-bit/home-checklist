import { ChecklistItem } from './ChecklistItem'

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

export function ChecklistSection({ section, items, completions, onToggle, currentRole }) {
  if (items.length === 0) return null

  // Determine if this section belongs to the other person (read-only)
  const isSpouseSection =
    (section === 'morning_rebecca' && currentRole === 'pz') ||
    (section === 'morning_pz' && currentRole === 'rebecca') ||
    (section === 'evening_rebecca' && currentRole === 'pz') ||
    (section === 'evening_pz' && currentRole === 'rebecca')

  return (
    <section className={`checklist-section ${isSpouseSection ? 'spouse-section' : ''}`}>
      <h2 className="section-header">
        {SECTION_LABELS[section]}
        {isSpouseSection && <span className="read-only-badge">read only</span>}
      </h2>
      <div className="section-items">
        {items.map(item => (
          <ChecklistItem
            key={item.id}
            item={item}
            completion={completions[item.id]}
            onToggle={onToggle}
            readOnly={isSpouseSection}
          />
        ))}
      </div>
    </section>
  )
}
