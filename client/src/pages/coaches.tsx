import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Coach } from '@/lib/types'
import { CoachCard } from '@/components/coaches/CoachCard'
import { Nav } from '@/components/layout/Nav'

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3959
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function Coaches() {
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [sortMode, setSortMode] = useState<'alpha' | 'nearby' | 'rating'>('alpha')

  useEffect(() => {
    // Try to get location silently
    navigator.geolocation.getCurrentPosition(
      pos => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setSortMode('nearby')
      },
      () => setSortMode('alpha'), // denied → alphabetical, no error
      { enableHighAccuracy: true, timeout: 8000 }
    )

    const params = new URLSearchParams(window.location.search || '')
    const q = params.get('q') || ''
    if (q) setSearch(q)
    fetchCoaches(q)
  }, [])

  async function fetchCoaches(query?: string) {
    setLoading(true)
    let q = supabase
      .from('coaches')
      .select('*, club:clubs(id, name, logo_url, lat, lng)')
      .eq('status', 'approved')
      .limit(100)

    if (query && query.trim()) {
      q = q.or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
    }

    const { data } = await q
    setCoaches((data as Coach[]) || [])
    setLoading(false)
  }

  // Sort coaches based on current mode + location
  const sorted = [...coaches].sort((a, b) => {
    if (sortMode === 'nearby' && coords) {
      const clubA = a.club as any
      const clubB = b.club as any
      const distA = clubA?.lat ? haversine(coords.lat, coords.lng, clubA.lat, clubA.lng) : 9999
      const distB = clubB?.lat ? haversine(coords.lat, coords.lng, clubB.lat, clubB.lng) : 9999
      return distA - distB
    }
    if (sortMode === 'rating') return b.avg_overall - a.avg_overall
    // alpha by last name
    return a.last_name.localeCompare(b.last_name)
  })

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

        <form onSubmit={handleSearch} className="flex gap-3 mb-4 max-w-lg">
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

        {/* Sort toggle */}
        <div className="flex gap-1.5 mb-6">
          {([
            { v: 'alpha' as const, l: 'A–Z' },
            { v: 'rating' as const, l: 'Top Rated' },
            ...(coords ? [{ v: 'nearby' as const, l: 'Nearest' }] : []),
          ]).map(s => (
            <button key={s.v} onClick={() => setSortMode(s.v)}
              className="font-mono text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all"
              style={sortMode === s.v
                ? { background: 'var(--fg-text)', color: 'white', borderColor: 'var(--fg-text)' }
                : { background: 'var(--fg-surface)', color: 'var(--fg-muted)', borderColor: 'var(--fg-border)' }}
              data-testid={`sort-${s.v}`}>{s.l}</button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="bg-white rounded-2xl p-5 animate-pulse border" style={{ borderColor: 'var(--fg-border)', height: 200 }} />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">⚽</div>
            <div className="font-semibold" style={{ color: 'var(--fg-text2)' }}>No coaches found</div>
            <div className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>Try a different search term</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sorted.map(c => <CoachCard key={c.id} coach={c} />)}
          </div>
        )}
      </div>
    </div>
  )
}
