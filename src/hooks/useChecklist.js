import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Returns today's date as YYYY-MM-DD in local time (not UTC, so midnight doesn't shift the date)
function todayLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Day of week: 0=Sunday, 1=Monday, ..., 6=Saturday
function todayDayOfWeek() {
  return new Date().getDay()
}

export function useChecklist(user) {
  const [items, setItems] = useState([])
  const [completions, setCompletions] = useState({}) // { item_id: completion_row }
  const [occasionalActive, setOccasionalActive] = useState(new Set()) // item_ids active today
  const [loading, setLoading] = useState(true)
  const today = todayLocal()

  const fetchData = useCallback(async () => {
    if (!user) return
    setLoading(true)

    // Fetch all active items
    const { data: allItems } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('active', true)
      .order('sort_order')

    // Fetch today's overrides (occasional items toggled on for today)
    const { data: overrides } = await supabase
      .from('daily_item_overrides')
      .select('item_id')
      .eq('active_on', today)

    // Fetch today's completions
    const { data: todayCompletions } = await supabase
      .from('checklist_completions')
      .select('*, profiles(display_name, role)')
      .eq('completed_on', today)

    const activeOccasional = new Set((overrides || []).map(o => o.item_id))
    const dow = todayDayOfWeek()

    // Filter to only items relevant today
    const todayItems = (allItems || []).filter(item => {
      const rule = item.recurrence_rule
      if (rule.type === 'daily') return true
      if (rule.type === 'weekly') return rule.days.includes(dow)
      if (rule.type === 'occasional') return activeOccasional.has(item.id)
      return false
    })

    // Map completions by item_id for quick lookup
    const completionMap = {}
    ;(todayCompletions || []).forEach(c => {
      completionMap[c.item_id] = c
    })

    setItems(todayItems)
    setCompletions(completionMap)
    setOccasionalActive(activeOccasional)
    setLoading(false)
  }, [user, today])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Realtime: watch for completion inserts/deletes and override changes
  useEffect(() => {
    if (!user) return

    const completionSub = supabase
      .channel('completions-today')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'checklist_completions',
        filter: `completed_on=eq.${today}`
      }, () => fetchData())
      .subscribe()

    const overrideSub = supabase
      .channel('overrides-today')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'daily_item_overrides',
        filter: `active_on=eq.${today}`
      }, () => fetchData())
      .subscribe()

    return () => {
      supabase.removeChannel(completionSub)
      supabase.removeChannel(overrideSub)
    }
  }, [user, today, fetchData])

  async function toggleItem(item) {
    const existing = completions[item.id]
    if (existing) {
      await supabase.from('checklist_completions').delete().eq('id', existing.id)
    } else {
      await supabase.from('checklist_completions').insert({
        item_id: item.id,
        completed_by: user.id,
        completed_on: today,
      })
    }
    // Realtime subscription will trigger fetchData, but refetch immediately for snappiness
    fetchData()
  }

  async function toggleOccasional(itemId) {
    if (occasionalActive.has(itemId)) {
      await supabase
        .from('daily_item_overrides')
        .delete()
        .eq('item_id', itemId)
        .eq('active_on', today)
    } else {
      await supabase.from('daily_item_overrides').insert({
        item_id: itemId,
        active_on: today,
        created_by: user.id,
      })
    }
    fetchData()
  }

  return { items, completions, occasionalActive, loading, toggleItem, toggleOccasional, refetch: fetchData }
}
