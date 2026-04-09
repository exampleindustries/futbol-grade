import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Club } from '@/lib/types'
import { ClubCard } from '@/components/clubs/ClubCard'
import { Nav } from '@/components/layout/Nav'

export default function Clubs() {
  const [clubs, setClubs] = useState<Club[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchClubs() }, [])

  async function fetchClubs(query?: string) {
    setLoading(true)
    let q = supabase
      .from('clubs')
      .select('*')
      .eq('status', 'approved')
      .order('avg_overall', { ascending: false })
      .limit(50)

    if (query && query.trim()) {
      q = q.ilike('name', `%${query}%`)
    }

    const { data } = await q
    setClubs((data as Club[]) || [])
    setLoading(false)
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    fetchClubs(search)
  }

  return (
    <div style={{ background: 'var(--fg-bg)', minHeight: '100vh' }}>
      <Nav />
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-2">
          <span className="font-mono text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--fg-muted)' }}>Directory</span>
          <h1 className="font-bebas text-3xl tracking-[2px]" style={{ color: 'var(--fg-text)' }}>CLUBS</h1>
        </div>

        <form onSubmit={handleSearch} className="flex gap-3 mb-8 max-w-lg">
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search clubs..."
            className="flex-1 px-4 py-2.5 rounded-xl text-sm border outline-none"
            style={{ borderColor: 'var(--fg-border2)', background: 'var(--fg-surface)', color: 'var(--fg-text)' }}
            data-testid="club-search"
          />
          <button type="submit" className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: 'var(--fg-green)' }} data-testid="club-search-btn">
            Search
          </button>
        </form>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => <div key={i} className="bg-white rounded-2xl p-5 animate-pulse border" style={{ borderColor: 'var(--fg-border)', height: 220 }} />)}
          </div>
        ) : clubs.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">🏟️</div>
            <div className="font-semibold" style={{ color: 'var(--fg-text2)' }}>No clubs found</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {clubs.map(c => <ClubCard key={c.id} club={c} />)}
          </div>
        )}
      </div>
    </div>
  )
}
