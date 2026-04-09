import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Coach, Club } from '@/lib/types'
import { Nav } from '@/components/layout/Nav'
import { ClubBadge } from '@/components/ui/ClubBadge'

import { API_BASE } from '@/lib/api'
const API = API_BASE
const AGE_GROUPS = ['U6', 'U8', 'U10', 'U12', 'U14', 'U16', 'U18', 'U19+']
const RADIUS_OPTIONS = [5, 10, 15, 25, 50]

// ── Age Group Modal ──────────────────────────────────────────
function AgeGroupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [ageGroup, setAgeGroup] = useState('')
  const [gender, setGender] = useState<'boys' | 'girls' | ''>('')
  const [results, setResults] = useState<Coach[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  async function handleSearch() {
    if (!ageGroup) return
    setLoading(true)
    setSearched(true)
    let query = supabase
      .from('coaches')
      .select('*, club:clubs(id, name, logo_url)')
      .eq('status', 'approved')
      .contains('age_groups', [ageGroup])
    if (gender) query = query.eq('gender', gender)
    query = query.order('avg_overall', { ascending: false }).limit(30)
    const { data } = await query
    setResults((data as Coach[]) || [])
    setLoading(false)
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative bg-white rounded-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-hidden flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-4 border-b" style={{ borderColor: 'var(--fg-border)' }}>
          <div className="flex items-center justify-between">
            <h2 className="font-bebas text-2xl tracking-[2px]" style={{ color: 'var(--fg-text)' }}>BROWSE BY AGE GROUP</h2>
            <button onClick={onClose} className="text-xl leading-none p-1 hover:opacity-60" style={{ color: 'var(--fg-muted)' }}>&times;</button>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {AGE_GROUPS.map(ag => (
              <button key={ag} onClick={() => setAgeGroup(ag)}
                className="font-mono text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all"
                style={ageGroup === ag
                  ? { background: 'var(--fg-green)', color: 'white', borderColor: 'var(--fg-green)' }
                  : { background: 'var(--fg-surface)', color: 'var(--fg-text2)', borderColor: 'var(--fg-border2)' }}
                data-testid={`age-${ag}`}>{ag}</button>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            {[{ v: '' as const, l: 'All' }, { v: 'boys' as const, l: 'Boys' }, { v: 'girls' as const, l: 'Girls' }].map(g => (
              <button key={g.l} onClick={() => setGender(g.v)}
                className="font-mono text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all"
                style={gender === g.v
                  ? { background: 'var(--fg-text)', color: 'white', borderColor: 'var(--fg-text)' }
                  : { background: 'var(--fg-surface)', color: 'var(--fg-muted)', borderColor: 'var(--fg-border2)' }}>{g.l}</button>
            ))}
            <button onClick={handleSearch} disabled={!ageGroup || loading}
              className="ml-auto font-mono text-xs font-semibold px-4 py-1.5 rounded-lg text-white transition-all disabled:opacity-50"
              style={{ background: 'var(--fg-green)' }}>Search</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : !searched ? (
            <div className="text-center py-8">
              <div className="text-3xl mb-2">📅</div>
              <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>Select an age group and hit Search</p>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-3xl mb-2">🔍</div>
              <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>No coaches found for {ageGroup}{gender ? ` (${gender})` : ''}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {results.map(c => (
                <a key={c.id} href={`/coaches/${c.id}`}
                  className="flex items-center gap-3 p-3 rounded-xl border hover:shadow-md transition-all"
                  style={{ borderColor: 'var(--fg-border)' }}>
                  <ClubBadge clubName={(c.club as any)?.name} logoUrl={(c.club as any)?.logo_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate" style={{ color: 'var(--fg-text)' }}>{c.first_name} {c.last_name}</div>
                    <div className="font-mono text-[10px]" style={{ color: 'var(--fg-muted)' }}>{(c.club as any)?.name || 'Independent'} · {c.city || 'SoCal'}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-yellow-500 text-xs">★</span>
                    <span className="font-bebas text-lg" style={{ color: 'var(--fg-text)' }}>{c.avg_overall.toFixed(1)}</span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Region Modal ─────────────────────────────────────────────
function RegionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [locStatus, setLocStatus] = useState<'idle' | 'loading' | 'granted' | 'denied'>('idle')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [radius, setRadius] = useState(25)
  const [clubs, setClubs] = useState<(Club & { distance?: number })[]>([])
  const [loading, setLoading] = useState(false)

  // Fetch all clubs alphabetically (fallback)
  async function fetchAllClubs() {
    setLoading(true)
    const { data } = await supabase
      .from('clubs')
      .select('id, name, city, state, logo_url, coach_count, avg_overall')
      .eq('status', 'approved')
      .order('name')
    setClubs((data || []) as any)
    setLoading(false)
  }

  function requestLocation() {
    setLocStatus('loading')
    navigator.geolocation.getCurrentPosition(
      pos => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocStatus('granted')
      },
      () => {
        setLocStatus('denied')
        fetchAllClubs()
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  useEffect(() => {
    if (!coords) return
    setLoading(true)
    fetch(`${API}/api/clubs/nearby?lat=${coords.lat}&lng=${coords.lng}&radius=${radius}`)
      .then(r => r.json())
      .then(data => { setClubs(data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [coords, radius])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative bg-white rounded-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-hidden flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-4 border-b" style={{ borderColor: 'var(--fg-border)' }}>
          <div className="flex items-center justify-between">
            <h2 className="font-bebas text-2xl tracking-[2px]" style={{ color: 'var(--fg-text)' }}>CLUBS NEAR YOU</h2>
            <button onClick={onClose} className="text-xl leading-none p-1 hover:opacity-60" style={{ color: 'var(--fg-muted)' }}>&times;</button>
          </div>

          {locStatus === 'idle' && (
            <button onClick={requestLocation}
              className="mt-4 w-full py-3 rounded-xl font-semibold text-sm text-white transition-all hover:brightness-110"
              style={{ background: 'var(--fg-green)' }}
              data-testid="share-location">
              📍 Share My Location
            </button>
          )}
          {locStatus === 'loading' && (
            <div className="mt-4 text-center py-3">
              <span className="font-mono text-xs" style={{ color: 'var(--fg-muted)' }}>Getting your location...</span>
            </div>
          )}
          {locStatus === 'denied' && (
            <div className="mt-3">
              <span className="font-mono text-[10px] font-bold" style={{ color: 'var(--fg-muted)' }}>Showing all clubs (A-Z)</span>
            </div>
          )}
          {locStatus === 'granted' && (
            <div className="mt-4">
              <span className="font-mono text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--fg-muted)' }}>Radius (miles)</span>
              <div className="flex gap-2 mt-2">
                {RADIUS_OPTIONS.map(r => (
                  <button key={r} onClick={() => setRadius(r)}
                    className="font-mono text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all"
                    style={radius === r
                      ? { background: 'var(--fg-green)', color: 'white', borderColor: 'var(--fg-green)' }
                      : { background: 'var(--fg-surface)', color: 'var(--fg-text2)', borderColor: 'var(--fg-border2)' }}
                    data-testid={`radius-${r}`}>{r} mi</button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {locStatus === 'idle' || locStatus === 'loading' ? (
            <div className="text-center py-8">
              <div className="text-3xl mb-2">📍</div>
              <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>Share your location to find nearby clubs</p>
            </div>
          ) : loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : clubs.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-3xl mb-2">🔍</div>
              <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>No clubs found within {radius} miles</p>
              <p className="text-xs mt-1" style={{ color: 'var(--fg-muted)' }}>Try increasing the radius</p>
            </div>
          ) : (
            <div className="space-y-2">
              <span className="font-mono text-[10px] font-bold" style={{ color: 'var(--fg-muted)' }}>
                {locStatus === 'granted' ? `${clubs.length} clubs within ${radius} miles (A-Z)` : `${clubs.length} clubs (A-Z)`}
              </span>
              {clubs.map(c => (
                <a key={c.id} href={`/clubs/${c.id}`}
                  className="flex items-center gap-3 p-3 rounded-xl border hover:shadow-md transition-all"
                  style={{ borderColor: 'var(--fg-border)' }}>
                  <ClubBadge clubName={c.name} logoUrl={c.logo_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate" style={{ color: 'var(--fg-text)' }}>{c.name}</div>
                    <div className="font-mono text-[10px]" style={{ color: 'var(--fg-muted)' }}>{c.city}, {c.state}</div>
                  </div>
                  <div className="text-right">
                    {(c as any).distance != null && (
                      <div className="font-bebas text-lg" style={{ color: 'var(--fg-green)' }}>{(c as any).distance} mi</div>
                    )}
                    <div className="font-mono text-[9px]" style={{ color: 'var(--fg-muted)' }}>{c.coach_count} coaches</div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CompactCoachCard({ coach }: { coach: Coach }) {
  const [expanded, setExpanded] = useState(false)
  const scores = [
    { label: 'Technical', val: coach.avg_technical },
    { label: 'Team Building', val: coach.avg_team_building },
    { label: 'Development', val: coach.avg_development },
    { label: 'Approachability', val: coach.avg_approachability },
    { label: 'Professionalism', val: coach.avg_professionalism },
    { label: 'Dedication', val: coach.avg_dedication },
  ]
  return (
    <a href={`/coaches/${coach.id}`}
      className="flex-shrink-0 w-72 bg-white border rounded-2xl overflow-hidden transition-all hover:shadow-lg cursor-pointer"
      style={{ borderColor: 'var(--fg-border)' }}
      data-testid={`carousel-coach-${coach.id}`}
      onClick={e => { if (expanded) { e.preventDefault() } }}
    >
      <div className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <ClubBadge clubName={(coach.club as any)?.name} logoUrl={(coach.club as any)?.logo_url} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate" style={{ color: 'var(--fg-text)' }}>{coach.first_name} {coach.last_name}</div>
            <div className="font-mono text-[10px]" style={{ color: 'var(--fg-muted)' }}>{coach.city || 'SoCal'}</div>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-yellow-500 text-sm">&#9733;</span>
            <span className="font-bebas text-2xl" style={{ color: 'var(--fg-text)' }}>{coach.avg_overall.toFixed(1)}</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px]" style={{ color: 'var(--fg-muted)' }}>{coach.total_reviews} review{coach.total_reviews !== 1 ? 's' : ''}</span>
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); setExpanded(!expanded) }}
            className="font-mono text-[10px] font-bold px-2 py-1 rounded hover:bg-gray-50 transition-colors"
            style={{ color: 'var(--fg-green)' }}
            data-testid="expand-card"
          >
            {expanded ? 'Less' : 'Details'} {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="px-5 pb-5 pt-0 border-t" style={{ borderColor: 'var(--fg-border)' }}>
          <div className="space-y-2 mt-3">
            {scores.map(s => (
              <div key={s.label} className="flex items-center gap-2">
                <span className="font-mono text-[10px] w-24 text-right flex-shrink-0" style={{ color: 'var(--fg-muted)' }}>{s.label}</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--fg-border)' }}>
                  <div className="h-full rounded-full" style={{ width: `${(s.val / 5) * 100}%`, background: 'var(--fg-green)' }} />
                </div>
                <span className="font-mono text-[10px] font-bold w-6" style={{ color: 'var(--fg-green)' }}>{s.val.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </a>
  )
}

function ClubMarquee({ clubs }: { clubs: Club[] }) {
  if (!clubs.length) return null
  const doubled = [...clubs, ...clubs]
  return (
    <div className="overflow-hidden relative">
      <div className="absolute left-0 top-0 bottom-0 w-16 z-10" style={{ background: 'linear-gradient(to right, #f7f5f0, transparent)' }} />
      <div className="absolute right-0 top-0 bottom-0 w-16 z-10" style={{ background: 'linear-gradient(to left, #f7f5f0, transparent)' }} />
      <div className="flex gap-8 items-center animate-marquee">
        {doubled.map((c, i) => (
          <a key={`${c.id}-${i}`} href={`/clubs/${c.id}`}
            className="flex-shrink-0 flex items-center gap-3 px-5 py-3 rounded-xl border bg-white hover:shadow-md transition-all"
            style={{ borderColor: 'var(--fg-border)' }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bebas text-xs border flex-shrink-0"
              style={{ background: 'var(--fg-green-pale)', color: 'var(--fg-green)', borderColor: 'var(--fg-border)' }}>
              {c.name.split(' ').map(w => w[0]).join('').slice(0, 4)}
            </div>
            <div>
              <div className="font-semibold text-sm whitespace-nowrap" style={{ color: 'var(--fg-text)' }}>{c.name}</div>
              <div className="flex items-center gap-1">
                <span className="text-yellow-500 text-xs">&#9733;</span>
                <span className="font-mono text-[10px] font-bold" style={{ color: 'var(--fg-text2)' }}>{c.avg_overall.toFixed(1)}</span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}

export default function Home() {
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [clubs, setClubs] = useState<Club[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const carouselRef = useRef<HTMLDivElement>(null)
  const [showAgeModal, setShowAgeModal] = useState(false)
  const [showRegionModal, setShowRegionModal] = useState(false)

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

  const topCoaches = coaches.filter(c => c.avg_overall >= 4.0)

  function scrollCarousel(dir: number) {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: dir * 300, behavior: 'smooth' })
    }
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
              { step: '01', icon: '\ud83d\udd0d', title: 'Find a Coach', desc: 'Browse coaches by club, city, or age group. Every SoCal youth coach has a profile with their rating breakdown.' },
              { step: '02', icon: '\u2b50', title: 'Rate Honestly', desc: 'Score coaches across 6 categories \u2014 technical skills, team building, development, approachability, professionalism, and dedication. All reviews are anonymous.' },
              { step: '03', icon: '\ud83d\udee1\ufe0f', title: 'Community Verified', desc: 'Every review goes through moderation before publishing. Coaches can claim their profile and get a verified badge on their page.' },
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

      <AgeGroupModal open={showAgeModal} onClose={() => setShowAgeModal(false)} />
      <RegionModal open={showRegionModal} onClose={() => setShowRegionModal(false)} />

      {/* Browse Categories — Dark Section */}
      <section style={{ background: '#1a3c24' }}>
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="text-center mb-10">
            <span className="font-mono text-[10px] font-bold tracking-widest uppercase" style={{ color: '#4ade80' }}>Explore</span>
            <h2 className="font-bebas text-3xl tracking-[2px] mt-1 text-white">BROWSE BY CATEGORY</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <a href="/clubs"
              className="group rounded-2xl p-6 border transition-all hover:scale-[1.02] hover:shadow-lg cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(74,222,128,0.15)' }}
              data-testid="category-clubs">
              <div className="text-3xl mb-3">⚽</div>
              <h3 className="font-bebas text-xl tracking-[1px] text-white mb-1 group-hover:text-green-400 transition-colors">CLUBS</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>All SoCal youth soccer clubs ranked by community ratings</p>
            </a>
            <button onClick={() => setShowAgeModal(true)}
              className="group rounded-2xl p-6 border transition-all hover:scale-[1.02] hover:shadow-lg cursor-pointer text-left"
              style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(74,222,128,0.15)' }}
              data-testid="category-by-age-group">
              <div className="text-3xl mb-3">📅</div>
              <h3 className="font-bebas text-xl tracking-[1px] text-white mb-1 group-hover:text-green-400 transition-colors">BY AGE GROUP</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>Find coaches for U8, U10, U12, U14, U16, and U18 teams</p>
            </button>
            <button onClick={() => setShowRegionModal(true)}
              className="group rounded-2xl p-6 border transition-all hover:scale-[1.02] hover:shadow-lg cursor-pointer text-left"
              style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(74,222,128,0.15)' }}
              data-testid="category-by-region">
              <div className="text-3xl mb-3">📍</div>
              <h3 className="font-bebas text-xl tracking-[1px] text-white mb-1 group-hover:text-green-400 transition-colors">BY REGION</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>Share your location to find clubs near you</p>
            </button>
            <a href="/events"
              className="group rounded-2xl p-6 border transition-all hover:scale-[1.02] hover:shadow-lg cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(74,222,128,0.15)' }}
              data-testid="category-events">
              <div className="text-3xl mb-3">🏆</div>
              <h3 className="font-bebas text-xl tracking-[1px] text-white mb-1 group-hover:text-green-400 transition-colors">EVENTS & PROGRAMS</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>Camps, clinics, tournaments, and training programs</p>
            </a>
          </div>
        </div>
      </section>

      {/* Recently Reviewed — Carousel */}
      <section className="py-12" style={{ background: '#f0f5f1' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between mb-6 rounded-xl px-5 py-4" style={{ background: 'linear-gradient(135deg, #c9a227 0%, #dbb730 50%, #e6c94a 100%)', boxShadow: '0 2px 12px rgba(180,140,20,.25)' }}>
            <div>
              <span className="font-mono text-[10px] font-bold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.7)' }}>Recently Reviewed</span>
              <h2 className="font-bebas text-2xl tracking-[2px] mt-1 text-white">TOP RATED COACHES</h2>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => scrollCarousel(-1)} className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
                style={{ background: 'rgba(255,255,255,0.25)', color: 'white' }} data-testid="carousel-prev">&#8249;</button>
              <button onClick={() => scrollCarousel(1)} className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
                style={{ background: 'rgba(255,255,255,0.25)', color: 'white' }} data-testid="carousel-next">&#8250;</button>
              <a href="/coaches" className="font-mono text-xs font-semibold px-4 py-2 rounded-lg transition-all ml-2"
                style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }} data-testid="see-all-coaches">
                See All →
              </a>
            </div>
          </div>
        </div>
        {loading ? (
          <div className="max-w-6xl mx-auto px-6 flex gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="w-72 flex-shrink-0 bg-white rounded-2xl p-5 animate-pulse border" style={{ borderColor: 'var(--fg-border)', height: 120 }} />
            ))}
          </div>
        ) : (
          <div className="max-w-6xl mx-auto px-6">
            <div ref={carouselRef} className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide" style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}>
              {topCoaches.map(c => <CompactCoachCard key={c.id} coach={c} />)}
            </div>
          </div>
        )}
      </section>

      {/* Club Marquee */}
      <section className="py-10" style={{ background: '#f7f5f0' }}>
        <div className="max-w-6xl mx-auto px-6 mb-6">
          <div className="text-center">
            <span className="font-mono text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--fg-muted)' }}>Featured Clubs</span>
            <h2 className="font-bebas text-2xl tracking-[2px] mt-1" style={{ color: 'var(--fg-text)' }}>SOCAL YOUTH SOCCER</h2>
          </div>
        </div>
        <ClubMarquee clubs={clubs} />
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

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  )
}
