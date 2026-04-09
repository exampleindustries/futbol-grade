import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Coach, Club } from '@/lib/types'
import { Nav } from '@/components/layout/Nav'
import { ClubBadge } from '@/components/ui/ClubBadge'

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

      {/* Recently Reviewed — Carousel */}
      <section className="py-12" style={{ background: '#f0f5f1' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="font-mono text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--fg-green)' }}>Recently Reviewed</span>
              <h2 className="font-bebas text-2xl tracking-[2px] mt-1" style={{ color: 'var(--fg-text)' }}>TOP RATED COACHES</h2>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => scrollCarousel(-1)} className="w-9 h-9 rounded-lg border flex items-center justify-center hover:bg-gray-50 transition-colors"
                style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-text2)' }} data-testid="carousel-prev">&#8249;</button>
              <button onClick={() => scrollCarousel(1)} className="w-9 h-9 rounded-lg border flex items-center justify-center hover:bg-gray-50 transition-colors"
                style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-text2)' }} data-testid="carousel-next">&#8250;</button>
              <a href="/coaches" className="font-mono text-xs font-semibold px-4 py-2 rounded-lg border transition-all hover:bg-gray-50 ml-2"
                style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-text2)' }} data-testid="see-all-coaches">
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

      {/* Browse Categories — Dark Section */}
      <section style={{ background: '#1a3c24' }}>
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="text-center mb-10">
            <span className="font-mono text-[10px] font-bold tracking-widest uppercase" style={{ color: '#4ade80' }}>Explore</span>
            <h2 className="font-bebas text-3xl tracking-[2px] mt-1 text-white">BROWSE BY CATEGORY</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: '\u26bd', title: 'Clubs', desc: 'All SoCal youth soccer clubs ranked by community ratings', href: '/clubs' },
              { icon: '\ud83d\udcc5', title: 'By Age Group', desc: 'Find coaches for U8, U10, U12, U14, U16, and U18 teams', href: '/coaches' },
              { icon: '\ud83d\udccd', title: 'By Region', desc: 'San Diego, LA, Orange County, Inland Empire, and more', href: '/coaches' },
              { icon: '\ud83c\udfc6', title: 'Events & Programs', desc: 'Camps, clinics, tournaments, and training programs', href: '/marketplace' },
            ].map(cat => (
              <a key={cat.title} href={cat.href}
                className="group rounded-2xl p-6 border transition-all hover:scale-[1.02] hover:shadow-lg"
                style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(74,222,128,0.15)' }}
                data-testid={`category-${cat.title.toLowerCase().replace(/[^a-z]/g, '-')}`}>
                <div className="text-3xl mb-3">{cat.icon}</div>
                <h3 className="font-bebas text-xl tracking-[1px] text-white mb-1 group-hover:text-green-400 transition-colors">{cat.title.toUpperCase()}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{cat.desc}</p>
              </a>
            ))}
          </div>
        </div>
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
