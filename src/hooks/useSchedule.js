import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useSchedule() {
  const [schedule, setSchedule] = useState({}) // { dow: ['morning','evening'], ... }
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchSchedule() }, [])

  async function fetchSchedule() {
    const { data } = await supabase.from('day_schedule').select('*').order('day_of_week')
    const map = {}
    for (const row of (data || [])) map[row.day_of_week] = row.tags || []
    setSchedule(map)
    setLoading(false)
  }

  function tagsForDay(dow) {
    return schedule[dow] || []
  }

  async function updateDayTags(dow, tags) {
    setSchedule(prev => ({ ...prev, [dow]: tags }))
    const { error } = await supabase.from('day_schedule').upsert({ day_of_week: dow, tags }, { onConflict: 'day_of_week' })
    if (error) { console.error('updateDayTags error:', error); fetchSchedule() }
    else fetchSchedule()
  }

  return { schedule, loading, tagsForDay, updateDayTags, fetchSchedule }
}
