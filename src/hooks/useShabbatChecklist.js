import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

export function useShabbatChecklist(user, fridayDate) {
  const [dailySections, setDailySections] = useState([])
  const [shabbatSections, setShabbatSections] = useState([])
  const [dailyItems, setDailyItems] = useState([])
  const [shabbatItems, setShabbatItems] = useState([])
  const [completions, setCompletions] = useState({})
  const [loading, setLoading] = useState(true)
  const localToggleIds = useRef(new Set())
  const profilesById = useRef({})

  const fetchData = useCallback(async () => {
    if (!user || !fridayDate) return
    setLoading(true)

    const [
      { data: allDailySections },
      { data: allShabbatSections },
      { data: allDailyItems },
      { data: allShabbatItems },
      { data: allCompletions },
      { data: allProfiles },
    ] = await Promise.all([
      supabase.from('sections').select('*').order('sort_order'),
      supabase.from('shabbat_sections').select('*').order('sort_order'),
      supabase.from('checklist_items').select('*').eq('active', true).order('sort_order'),
      supabase.from('shabbat_items').select('*').eq('active', true).order('sort_order'),
      supabase.from('shabbat_completions').select('*').eq('friday_date', fridayDate),
      supabase.from('profiles').select('id, display_name, role'),
    ])

    const profiles = Object.fromEntries((allProfiles || []).map(p => [p.id, p]))
    profilesById.current = profiles

    // Exclude sections with "evening" in their name from the Shabbat view
    const filteredDailySections = (allDailySections || []).filter(s => !s.label.toLowerCase().includes('evening'))
    const filteredSectionIds = new Set(filteredDailySections.map(s => s.id))
    const filteredDailyItems = (allDailyItems || []).filter(i => filteredSectionIds.has(i.section))

    const completionMap = {}
    for (const c of (allCompletions || [])) {
      completionMap[c.item_id] = { ...c, profile: profiles[c.completed_by] }
    }

    setDailySections(filteredDailySections)
    setShabbatSections(allShabbatSections || [])
    setDailyItems(filteredDailyItems)
    setShabbatItems(allShabbatItems || [])
    setCompletions(completionMap)
    setLoading(false)
  }, [user, fridayDate])

  useEffect(() => { fetchData() }, [fetchData])

  const fetchCompletions = useCallback(async () => {
    if (!user || !fridayDate) return
    const { data } = await supabase.from('shabbat_completions').select('*').eq('friday_date', fridayDate)
    const profiles = profilesById.current
    const completionMap = {}
    for (const c of (data || [])) {
      completionMap[c.item_id] = { ...c, profile: profiles[c.completed_by] }
    }
    setCompletions(completionMap)
  }, [user, fridayDate])

  useEffect(() => {
    if (!user || !fridayDate) return
    const channel = supabase
      .channel(`shabbat-${fridayDate}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'shabbat_completions',
        filter: `friday_date=eq.${fridayDate}`,
      }, (payload) => {
        const itemId = payload.new?.item_id ?? payload.old?.item_id
        if (itemId && localToggleIds.current.has(itemId)) {
          localToggleIds.current.delete(itemId)
          return
        }
        fetchCompletions()
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user, fridayDate, fetchCompletions])

  async function toggleItem(item, source) {
    const existing = completions[item.id]
    localToggleIds.current.add(item.id)

    if (existing) {
      setCompletions(prev => { const next = { ...prev }; delete next[item.id]; return next })
      await supabase.from('shabbat_completions').delete().eq('id', existing.id)
    } else {
      const optimistic = { item_id: item.id, item_source: source, friday_date: fridayDate, completed_by: user.id, profile: profilesById.current[user.id] }
      setCompletions(prev => ({ ...prev, [item.id]: optimistic }))
      const { data } = await supabase.from('shabbat_completions').insert({
        item_id: item.id, item_source: source, friday_date: fridayDate, completed_by: user.id,
      }).select().single()
      if (data) setCompletions(prev => ({ ...prev, [item.id]: { ...data, profile: profilesById.current[data.completed_by] } }))
    }
  }

  async function addShabbatSection(label) {
    const id = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
    const maxOrder = Math.max(0, ...shabbatSections.map(s => s.sort_order))
    await supabase.from('shabbat_sections').insert({ id, label: label.trim(), sort_order: maxOrder + 10 })
    fetchData()
  }

  return {
    dailySections, shabbatSections, dailyItems, shabbatItems, completions, loading,
    toggleItem, addShabbatSection, refetch: fetchData,
  }
}
