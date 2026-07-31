import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useChecklist } from './hooks/useChecklist'
import { useSections } from './hooks/useSections'
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

export default function App() {
  const { user, profile, loading: authLoading, signIn, signOut } = useAuth()
  const [viewDate, setViewDate] = useState(todayLocal)
  const { items, completions, occasionalActive, loading: listLoading, toggleItem, toggleOccasional, skipItem, refetch } = useChecklist(user, viewDate)
  const { sections, loading: sectionsLoading, addSection, fetchSections } = useSections()
  const [showPicker, setShowPicker] = useState(false)
  const [showManager, setShowManager] = useState(false)
  const [editItem, setEditItem] = useState(null)

  function handleEditItem(item) {
    setEditItem(item)
    setShowManager(true)
  }

  if (authLoading || sectionsLoading) return <div className="loading-screen">Loading…</div>
  if (!user) return <Login signIn={signIn} />

  return (
    <>
      <TodayView
        sections={sections}
        items={items}
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
          onSectionAdded={fetchSections}
          onItemChanged={refetch}
        />
      )}
    </>
  )
}
