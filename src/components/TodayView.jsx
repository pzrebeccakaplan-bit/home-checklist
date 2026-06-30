import { ChecklistSection } from './ChecklistSection'

const SECTION_ORDER = [
  'morning_shared',
  'morning_rebecca',
  'morning_pz',
  'evening_shared',
  'evening_rebecca',
  'evening_pz',
  'before_bed_discuss',
  'last_to_bed',
]

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

export function TodayView({ items, completions, onToggle, currentRole, onOpenPicker, onOpenManager, onSignOut, profile }) {
  const today = new Date()
  const dateLabel = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  // Group items by section
  const bySection = {}
  for (const section of SECTION_ORDER) bySection[section] = []
  for (const item of items) {
    if (bySection[item.section]) bySection[item.section].push(item)
  }

  const totalItems = items.length
  const doneCount = Object.keys(completions).length

  return (
    <div className="today-view">
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title">Home Checklist</h1>
          <p className="date-label">{dateLabel}</p>
        </div>
        <div className="header-right">
          <span className="progress-badge">{doneCount}/{totalItems}</span>
          <button className="header-btn" onClick={onOpenPicker}>+ Today</button>
          <button className="header-btn" onClick={onOpenManager}>Manage</button>
          <button className="header-btn secondary" onClick={onSignOut}>
            {profile?.display_name || 'Sign out'}
          </button>
        </div>
      </header>

      <main className="sections-container">
        {SECTION_ORDER.map(section => (
          <ChecklistSection
            key={section}
            section={section}
            items={bySection[section]}
            completions={completions}
            onToggle={onToggle}
            currentRole={currentRole}
          />
        ))}
        {items.length === 0 && (
          <p className="empty-state">No items for today. Tap "+ Today" to add occasional items.</p>
        )}
      </main>
    </div>
  )
}
