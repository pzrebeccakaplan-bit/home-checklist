import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useChecklist } from './hooks/useChecklist'
import { Login } from './components/Login'
import { TodayView } from './components/TodayView'
import { OccasionalPicker } from './components/OccasionalPicker'
import { ItemManager } from './components/ItemManager'

export default function App() {
  const { user, profile, loading: authLoading, signIn, signOut } = useAuth()
  const { items, completions, occasionalActive, loading: listLoading, toggleItem, toggleOccasional } = useChecklist(user)
  const [showPicker, setShowPicker] = useState(false)
  const [showManager, setShowManager] = useState(false)

  if (authLoading) return <div className="loading-screen">Loading…</div>
  if (!user) return <Login signIn={signIn} />

  return (
    <>
      <TodayView
        items={items}
        completions={completions}
        onToggle={toggleItem}
        currentRole={profile?.role}
        onOpenPicker={() => setShowPicker(true)}
        onOpenManager={() => setShowManager(true)}
        onSignOut={signOut}
        profile={profile}
      />
      {showPicker && (
        <OccasionalPicker
          occasionalActive={occasionalActive}
          onToggle={toggleOccasional}
          onClose={() => setShowPicker(false)}
        />
      )}
      {showManager && (
        <ItemManager onClose={() => setShowManager(false)} />
      )}
    </>
  )
}
