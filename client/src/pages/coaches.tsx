import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Coach } from '@/lib/types'
import { CoachCard } from '@/components/coaches/CoachCard'
import { Nav } from '@/components/layout/Nav'

export default function Coaches() {
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '')
    const q = params.get('q') || ''
    if (q) setSearch(q)
    fetchCoaches(q)
  }, [])

  async function fetchCoaches(query?: string) {
    setLoading(true)
    let q = supabase
      .from('coaches')
      .select('*, club:clubs(id, name, logo_url)')
      .eq('status', 'approved')
      .order('avg_overall', { ascending: false })
      .limit(50)

    if (query && query.trim()) {
      q = q.or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
    }

    const { data } = await q
    setCoaches((data as Coach[]) || [])
    setLoading(false)
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    fetchCoaches(search)
  }

  return (
    <div style={{ background: 'var(--fg-bg)', minHeight: '100vh' }}>
      <Nav />
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="font-mono text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--fg-muted)' }}>Directory</span>
            <h1 className="font-bebas text-3xl tracking-[2px]" style={{ color: 'var(--fg-text)' }}>COACHES</h1>
          </div>
        </div>

        <form onSubmit={handleSearch} className="flex gap-3 mb-8 max-w-lg">
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name..."
            className="flex-1 px-4 py-2.5 rounded-xl text-sm border outline-none"
            style={{ borderColor: 'var(--fg-border2)', background: 'var(--fg-surface)', color: 'var(--fg-text)' }}
            data-testid="coach-search"
          />
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'var(--fg-green)' }}
            data-testid="coach-search-btn"
          >
            Search
          </button>
        </form>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="bg-white rounded-2xl p-5 animate-pulse border" style={{ borderColor: 'var(--fg-border)', height: 200 }} />
            ))}
          </div>
        ) : coaches.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">⚽</div>
            <div className="font-semibold" style={{ color: 'var(--fg-text2)' }}>No coaches found</div>
            <div className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>Try a different search term</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {coaches.map(c => <CoachCard key={c.id} coach={c} />)}
          </div>
        )}
      </div>
    </div>
  )
}
