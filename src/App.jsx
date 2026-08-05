import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useChecklist } from './hooks/useChecklist'
import { useSections } from './hooks/useSections'
import { useSchedule } from './hooks/useSchedule'
import { Login } from './components/Login'
import { TodayView } from './components/TodayView'
import { OccasionalPicker } from './components/OccasionalPicker'
import { ItemManager } from './components/ItemManager'


function todayLocal() {
  const d = new Date()
  if (d.getHours() < 5) d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function offsetDate(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function dowFromDateStr(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

export default function App() {
  const { user, profile, loading: authLoading, signIn, signOut } = useAuth()
  const [viewDate, setViewDate] = useState(todayLocal)
  const { items, completions, occasionalActive, loading: listLoading, toggleItem, toggleOccasional, skipItem, refetch } = useChecklist(user, viewDate)
  const { sections, loading: sectionsLoading, addSection, fetchSections, updateSectionTags } = useSections()
  const { schedule, loading: scheduleLoading, tagsForDay, updateDayTags, fetchSchedule } = useSchedule()
  const [showPicker, setShowPicker] = useState(false)
  const [showManager, setShowManager] = useState(false)
  const [editItem, setEditItem] = useState(null)

  const dow = dowFromDateStr(viewDate)
  const activeTags = tagsForDay(dow)
  const dayHasSchedule = activeTags.length > 0

  // Only filter by tags if today has a schedule configured; otherwise show all sections
  const visibleSections = sections.filter(s =>
    !dayHasSchedule || !s.tags || s.tags.length === 0 || s.tags.some(t => activeTags.includes(t))
  )
  const visibleSectionIds = new Set(visibleSections.map(s => s.id))
  const visibleItems = dayHasSchedule
    ? items.filter(i => !i.section || visibleSectionIds.has(i.section))
    : items

  function handleEditItem(item) {
    setEditItem(item)
    setShowManager(true)
  }

  if (authLoading || sectionsLoading || scheduleLoading) return <div className="loading-screen">Loading…</div>
  if (!user) return <Login signIn={signIn} />

  return (
    <>
      <TodayView
        sections={visibleSections}
        items={visibleItems}
        completions={completions}
        onToggle={toggleItem}
        onEdit={handleEditItem}
        onDelete={refetch}
        onSkip={skipItem}
        onItemAdded={refetch}
        currentRole={profile?.role}
        onOpenPicker={() => setShowPicker(true)}
        onOpenManager={() => { setEditItem(null); setShowManager(true) }}
        onSignOut={signOut}
        onAddSection={addSection}
        onSectionAdded={fetchSections}
        profile={profile}
        viewDate={viewDate}
        onPrevDay={() => setViewDate(d => offsetDate(d, -1))}
        onNextDay={() => setViewDate(d => offsetDate(d, 1))}
        onGoToday={() => setViewDate(todayLocal())}
        onJumpToDate={setViewDate}
      />
      {showPicker && (
        <OccasionalPicker
          sections={sections}
          occasionalActive={occasionalActive}
          onToggle={toggleOccasional}
          onClose={() => setShowPicker(false)}
          viewDate={viewDate}
        />
      )}
      {showManager && (
        <ItemManager
          sections={sections}
          onClose={() => { setShowManager(false); setEditItem(null) }}
          initialEditItem={editItem}
          onSectionAdded={() => { fetchSections(); fetchSchedule() }}
          onItemChanged={refetch}
          schedule={schedule}
          onUpdateDayTags={updateDayTags}
          onUpdateSectionTags={updateSectionTags}
        />
      )}
    </>
  )
}
