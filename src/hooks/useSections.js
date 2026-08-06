import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useSections() {
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchSections() }, [])

  async function fetchSections() {
    const { data } = await supabase
      .from('sections')
      .select('*')
      .order('sort_order')
    setSections(data || [])
    setLoading(false)
  }

  async function addSection(label, fridayOnly = false) {
    const id = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
    const maxOrder = Math.max(0, ...sections.map(s => s.sort_order))
    const { data } = await supabase
      .from('sections')
      .insert({ id, label: label.trim(), sort_order: maxOrder + 10, friday_only: fridayOnly })
      .select()
      .single()
    if (data) setSections(prev => [...prev, data])
    return data
  }

  async function updateSectionTags(sectionId, tags) {
    const { error } = await supabase.from('sections').update({ tags }).eq('id', sectionId)
    if (error) console.error('updateSectionTags error:', error)
    else console.log('updateSectionTags ok, sectionId:', sectionId, 'tags:', tags)
    fetchSections()
  }

  return { sections, loading, fetchSections, addSection, updateSectionTags }
}
