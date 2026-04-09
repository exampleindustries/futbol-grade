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
    if (search.trim()) window.location.href = `/coaches?q=${encodeURIComponent(search)}`
  }

  return (
    <div style={{ background: 'var(--fg-bg)', minHeight: '100vh' }}>
      <Nav />

      {/* Hero */}
      <section className="relative overflow-hidden" style={{ minHeight: 520 }}>
        <div className="absolute inset-0" style={{ backgroundImage: 'url(/hero-stadium.jpg)', backgroundSize: 'cover', backgroundPosition: 'center 40%' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(10,30,18,0.88) 0%, rgba(20,80,40,0.82) 50%, rgba(26,60,36,0.85) 100%)' }} />
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
            <a href="/coaches" className="font-mono text-[11px] font-bold tracking-widest text-white/50 hover:text-white/80 transition-colors uppercase" data-testid="hero-browse-coaches">
              Browse Coaches →
            </a>
            <a href="/clubs" className="font-mono text-[11px] font-bold tracking-widest text-white/50 hover:text-white/80 transition-colors uppercase" data-testid="hero-browse-clubs">
              Browse Clubs →
            </a>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-b" style={{ borderColor: 'var(--fg-border)', background: 'var(--fg-surface)' }}>
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="text-center mb-10">
            <span className="font-mono text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--fg-green)' }}>For Parents &amp; Players</span>
            <h2 className="font-bebas text-3xl tracking-[2px] mt-1" style={{ color: 'var(--fg-text)' }}>HOW IT WORKS</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                icon: '🔍',
                title: 'Find a Coach',
                desc: 'Browse coaches by club, city, or age group. Every SoCal youth coach has a profile with their rating breakdown.',
              },
              {
                step: '02',
                icon: '⭐',
                title: 'Rate Honestly',
                desc: 'Score coaches across 6 categories — technical skills, team building, development, approachability, professionalism, and dedication. All reviews are anonymous.',
              },
              {
                step: '03',
                icon: '🛡️',
                title: 'Community Verified',
                desc: 'Every review goes through moderation before publishing. Coaches can claim their profile, get verified, and receive email alerts on new reviews.',
              },
            ].map(item => (
              <div key={item.step} className="bg-white border rounded-2xl p-6 text-center" style={{ borderColor: 'var(--fg-border)' }}>
                <div className="text-3xl mb-3">{item.icon}</div>
                <div className="font-mono text-[10px] font-bold tracking-widest mb-2" style={{ color: 'var(--fg-green)' }}>STEP {item.step}</div>
                <h3 className="font-bebas text-xl tracking-[1px] mb-2" style={{ color: 'var(--fg-text)' }}>{item.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-muted)' }}>{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <a href="/auth/register" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110"
              style={{ background: 'var(--fg-green)', boxShadow: '0 4px 16px rgba(26,110,56,.25)' }}
              data-testid="how-it-works-cta">
              Create Free Account
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
          <a href="/coaches" className="font-mono text-xs font-semibold px-4 py-2 rounded-lg border transition-all hover:bg-gray-50" style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-text2)' }} data-testid="see-all-coaches">
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
          <a href="/clubs" className="font-mono text-xs font-semibold px-4 py-2 rounded-lg border transition-all hover:bg-gray-50" style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-text2)' }} data-testid="see-all-clubs">
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
