import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

// Parse YYYY-MM-DD as local time to get day of week (avoids UTC midnight shifts)
function dowFromDateStr(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

export function useChecklist(user, viewDate) {
  const [items, setItems] = useState([])
  const [completions, setCompletions] = useState({})
  const [occasionalActive, setOccasionalActive] = useState(new Set())
  const [profilesById, setProfilesById] = useState({})
  const [loading, setLoading] = useState(true)
  const localToggleIds = useRef(new Set())

  const fetchData = useCallback(async () => {
    if (!user || !viewDate) return
    setLoading(true)

    const [{ data: activeItems }, { data: overrides }, { data: dayCompletions }, { data: allProfiles }] = await Promise.all([
      supabase.from('checklist_items').select('*').eq('active', true).order('sort_order'),
      supabase.from('daily_item_overrides').select('item_id').eq('active_on', viewDate),
      supabase.from('checklist_completions').select('*').eq('completed_on', viewDate),
      supabase.from('profiles').select('id, display_name, role'),
    ])

    // Also fetch inactive items that have a completion for this date (historical records)
    const completedItemIds = (dayCompletions || []).map(c => c.item_id)
    const activeItemIds = new Set((activeItems || []).map(i => i.id))
    const inactiveCompletedIds = completedItemIds.filter(id => !activeItemIds.has(id))
    let historicalItems = []
    if (inactiveCompletedIds.length > 0) {
      const { data } = await supabase
        .from('checklist_items').select('*').in('id', inactiveCompletedIds)
      historicalItems = data || []
    }
    const allItems = [...(activeItems || []), ...historicalItems]
    const profiles = Object.fromEntries((allProfiles || []).map(p => [p.id, p]))
    setProfilesById(profiles)

    const [{ data: skips }, { data: textOverrides }] = await Promise.all([
      supabase.from('daily_item_skips').select('item_id').eq('skip_on', viewDate),
      supabase.from('daily_item_text_overrides').select('item_id, display_text').eq('override_on', viewDate),
    ])
    const skippedIds = new Set((skips || []).map(s => s.item_id))
    const textOverrideMap = Object.fromEntries((textOverrides || []).map(t => [t.item_id, t.display_text]))

    const activeOccasional = new Set((overrides || []).map(o => o.item_id))
    const dow = dowFromDateStr(viewDate)

    const historicalIds = new Set(historicalItems.map(i => i.id))
    const dayItems = (allItems || []).filter(item => {
      if (historicalIds.has(item.id)) return true // always show historically completed items
      if (skippedIds.has(item.id)) return false
      const rule = item.recurrence_rule
      if (rule.type === 'daily') return true
      if (rule.type === 'weekly') return rule.days.includes(dow)
      if (rule.type === 'occasional') return activeOccasional.has(item.id)
      if (rule.type === 'once') return rule.date === viewDate
      return false
    }).map(item => ({
      ...item,
      ...(textOverrideMap[item.id] !== undefined ? { displayText: textOverrideMap[item.id] } : {}),
    }))

    const completionMap = {}
    ;(dayCompletions || []).forEach(c => {
      completionMap[c.item_id] = { ...c, profile: profiles[c.completed_by] }
    })

    setItems(dayItems)
    setCompletions(completionMap)
    setOccasionalActive(activeOccasional)
    setLoading(false)
  }, [user, viewDate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const fetchCompletions = useCallback(async () => {
    if (!user || !viewDate) return
    const [{ data: dayCompletions }, { data: allProfiles }] = await Promise.all([
      supabase.from('checklist_completions').select('*').eq('completed_on', viewDate),
      supabase.from('profiles').select('id, display_name, role'),
    ])
    const profiles = Object.fromEntries((allProfiles || []).map(p => [p.id, p]))
    setProfilesById(profiles)
    const completionMap = {}
    ;(dayCompletions || []).forEach(c => {
      completionMap[c.item_id] = { ...c, profile: profiles[c.completed_by] }
    })
    setCompletions(completionMap)
  }, [user, viewDate])

  useEffect(() => {
    if (!user || !viewDate) return

    const completionSub = supabase
      .channel(`completions-${viewDate}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'checklist_completions',
        filter: `completed_on=eq.${viewDate}`
      }, (payload) => {
        const itemId = payload.new?.item_id ?? payload.old?.item_id
        if (itemId && localToggleIds.current.has(itemId)) {
          localToggleIds.current.delete(itemId)
          return
        }
        fetchCompletions()
      })
      .subscribe()

    const overrideSub = supabase
      .channel(`overrides-${viewDate}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'daily_item_overrides',
        filter: `active_on=eq.${viewDate}`
      }, () => fetchData())
      .subscribe()

    return () => {
      supabase.removeChannel(completionSub)
      supabase.removeChannel(overrideSub)
    }
  }, [user, viewDate, fetchData, fetchCompletions])

  async function toggleItem(item) {
    const existing = completions[item.id]
    localToggleIds.current.add(item.id)

    if (existing) {
      setCompletions(prev => {
        const next = { ...prev }
        delete next[item.id]
        return next
      })
      const { error } = await supabase.from('checklist_completions').delete().eq('id', existing.id)
      if (error) { localToggleIds.current.delete(item.id); fetchData() }
    } else {
      const optimistic = { item_id: item.id, completed_by: user.id, completed_on: viewDate, profile: profilesById[user.id] }
      setCompletions(prev => ({ ...prev, [item.id]: optimistic }))
      const { data, error } = await supabase.from('checklist_completions').insert({
        item_id: item.id,
        completed_by: user.id,
        completed_on: viewDate,
      }).select().single()
      if (error) { localToggleIds.current.delete(item.id); fetchData() }
      else setCompletions(prev => ({ ...prev, [item.id]: { ...data, profile: prev[item.id]?.profile } }))
    }
  }

  async function toggleOccasional(itemId) {
    if (occasionalActive.has(itemId)) {
      setOccasionalActive(prev => { const n = new Set(prev); n.delete(itemId); return n })
      await supabase.from('daily_item_overrides').delete().eq('item_id', itemId).eq('active_on', viewDate)
    } else {
      setOccasionalActive(prev => new Set([...prev, itemId]))
      await supabase.from('daily_item_overrides').insert({ item_id: itemId, active_on: viewDate, created_by: user.id })
    }
    fetchData()
  }

  async function skipItem(itemId) {
    await supabase.from('daily_item_skips').insert({ item_id: itemId, skip_on: viewDate, created_by: user.id })
    fetchData()
  }

  async function deleteItem(itemId) {
    setItems(prev => prev.filter(i => i.id !== itemId))
    await supabase.from('checklist_items').update({ active: false }).eq('id', itemId)
  }

  return { items, completions, occasionalActive, loading, toggleItem, toggleOccasional, skipItem, deleteItem, refetch: fetchData }
}
