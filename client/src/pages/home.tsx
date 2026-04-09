import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Coach, Club } from '@/lib/types'
import { CoachCard } from '@/components/coaches/CoachCard'
import { ClubCard } from '@/components/clubs/ClubCard'
import { Nav } from '@/components/layout/Nav'

export default function Home() {
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [clubs, setClubs] = useState<Club[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [c, cl] = await Promise.all([
        supabase.from('coaches').select('*, club:clubs(id, name, logo_url)').eq('status', 'approved').eq('region', 'socal').order('avg_overall', { ascending: false }).limit(12),
        supabase.from('clubs').select('*').eq('status', 'approved').eq('region', 'socal').order('avg_overall', { ascending: false }).limit(12),
      ])
      setCoaches((c.data as Coach[]) || [])
      setClubs((cl.data as Club[]) || [])
      setLoading(false)
    }
    load()
  }, [])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (search.trim()) window.location.hash = `#/coaches?q=${encodeURIComponent(search)}`
  }

  return (
    <div style={{ background: 'var(--fg-bg)', minHeight: '100vh' }}>
      <Nav />

      {/* Hero */}
      <section className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #1a2e22 0%, #1a6e38 50%, #22903f 100%)' }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.2) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(46,170,80,0.3) 0%, transparent 40%)' }} />
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28 relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full rating-pulse" style={{ background: '#2eaa50' }} />
            <span className="font-mono text-[11px] font-bold tracking-widest uppercase text-white/60">Southern California</span>
          </div>
          <h1 className="font-bebas text-5xl md:text-7xl tracking-[4px] text-white leading-tight mb-3">
            FUTBOL<span style={{ color: '#2eaa50' }}>GRADE</span>
          </h1>
          <p className="text-lg md:text-xl text-white/70 max-w-xl mb-8 leading-relaxed">
            Rate &amp; discover youth soccer coaches in Southern California. Honest, anonymous reviews from the community.
          </p>
          <form onSubmit={handleSearch} className="flex gap-3 max-w-lg">
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search coaches or clubs..."
              className="flex-1 px-5 py-3.5 rounded-xl text-sm border-0 outline-none"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'white', backdropFilter: 'blur(8px)' }}
              data-testid="hero-search"
            />
            <button
              type="submit"
              className="px-6 py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110"
              style={{ background: '#2eaa50', boxShadow: '0 4px 16px rgba(46,170,80,.4)' }}
              data-testid="hero-search-btn"
            >
              Search
            </button>
          </form>
          <div className="flex gap-4 mt-6">
            <a href="/#/coaches" className="font-mono text-[11px] font-bold tracking-widest text-white/50 hover:text-white/80 transition-colors uppercase" data-testid="hero-browse-coaches">
              Browse Coaches →
            </a>
            <a href="/#/clubs" className="font-mono text-[11px] font-bold tracking-widest text-white/50 hover:text-white/80 transition-colors uppercase" data-testid="hero-browse-clubs">
              Browse Clubs →
            </a>
          </div>
        </div>
      </section>

      {/* Top Coaches */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <span className="font-mono text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--fg-muted)' }}>Top Rated</span>
            <h2 className="font-bebas text-2xl tracking-[2px] mt-1" style={{ color: 'var(--fg-text)' }}>COACHES</h2>
          </div>
          <a href="/#/coaches" className="font-mono text-xs font-semibold px-4 py-2 rounded-lg border transition-all hover:bg-gray-50" style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-text2)' }} data-testid="see-all-coaches">
            See All →
          </a>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="bg-white rounded-2xl p-5 animate-pulse border" style={{ borderColor: 'var(--fg-border)', height: 200 }}>
                <div className="h-4 bg-gray-100 rounded w-1/2 mb-3" />
                <div className="h-3 bg-gray-100 rounded w-1/3 mb-6" />
                <div className="space-y-2">
                  <div className="h-2 bg-gray-100 rounded" />
                  <div className="h-2 bg-gray-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {coaches.map(c => <CoachCard key={c.id} coach={c} />)}
          </div>
        )}
      </section>

      {/* Top Clubs */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <span className="font-mono text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--fg-muted)' }}>Top Rated</span>
            <h2 className="font-bebas text-2xl tracking-[2px] mt-1" style={{ color: 'var(--fg-text)' }}>CLUBS</h2>
          </div>
          <a href="/#/clubs" className="font-mono text-xs font-semibold px-4 py-2 rounded-lg border transition-all hover:bg-gray-50" style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-text2)' }} data-testid="see-all-clubs">
            See All →
          </a>
        </div>
        {!loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {clubs.map(c => <ClubCard key={c.id} club={c} />)}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t py-8" style={{ borderColor: 'var(--fg-border)' }}>
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="font-bebas text-lg tracking-[2px]" style={{ color: 'var(--fg-muted)' }}>
            FUTBOL<span style={{ color: 'var(--fg-green-light)' }}>GRADE</span>
          </span>
          <span className="font-mono text-xs" style={{ color: 'var(--fg-muted)' }}>
            Independent ratings · Not affiliated with any club
          </span>
        </div>
      </footer>
    </div>
  )
}
