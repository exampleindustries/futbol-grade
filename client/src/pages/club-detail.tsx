import { useState, useEffect } from 'react'
import { useRoute } from 'wouter'
import { supabase } from '@/lib/supabase'
import type { Club, Coach } from '@/lib/types'
import { KPI_AVG_KEYS } from '@/lib/types'
import { Nav } from '@/components/layout/Nav'
import { RatingBadge } from '@/components/ui/RatingBadge'
import { KpiBar } from '@/components/ui/KpiBar'
import { CoachCard } from '@/components/coaches/CoachCard'

export default function ClubDetail() {
  const [, params] = useRoute('/clubs/:id')
  const id = params?.id
  const [club, setClub] = useState<Club | null>(null)
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    async function load() {
      const [c, co] = await Promise.all([
        supabase.from('clubs').select('*').eq('id', id).single(),
        supabase.from('coaches').select('*, club:clubs(id, name, logo_url)').eq('club_id', id).eq('status', 'approved').order('avg_overall', { ascending: false }),
      ])
      setClub(c.data as Club | null)
      setCoaches((co.data as Coach[]) || [])
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return (
    <div style={{ background: 'var(--fg-bg)', minHeight: '100vh' }}>
      <Nav />
      <div className="max-w-4xl mx-auto px-6 py-12 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4" />
        <div className="h-4 bg-gray-200 rounded w-1/4" />
      </div>
    </div>
  )

  if (!club) return (
    <div style={{ background: 'var(--fg-bg)', minHeight: '100vh' }}>
      <Nav />
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <div className="text-4xl mb-3">🏟️</div>
        <h2 className="font-bebas text-2xl" style={{ color: 'var(--fg-text)' }}>Club Not Found</h2>
      </div>
    </div>
  )

  return (
    <div style={{ background: 'var(--fg-bg)', minHeight: '100vh' }}>
      <Nav />
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="bg-white border rounded-2xl p-6 md:p-8 mb-6" style={{ borderColor: 'var(--fg-border)' }}>
          <div className="flex items-start gap-4 md:gap-6">
            <div
              className="w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center font-bebas text-xl md:text-2xl flex-shrink-0 border-2 overflow-hidden"
              style={{ borderColor: 'var(--fg-border)', background: 'var(--fg-green-pale)', color: 'var(--fg-green)' }}
            >
              {club.abbr || club.name.slice(0, 3).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-bebas text-3xl md:text-4xl tracking-[2px]" style={{ color: 'var(--fg-text)' }} data-testid="club-name">
                {club.name}
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="font-mono text-xs" style={{ color: 'var(--fg-muted)' }}>📍 {club.city || 'SoCal'}</span>
                <span className="font-mono text-[11px]" style={{ color: 'var(--fg-muted)' }}>
                  {club.coach_count} coaches · {club.total_reviews} reviews
                </span>
              </div>
            </div>
            <RatingBadge score={club.avg_overall} size="xl" showGrade />
          </div>
        </div>

        {/* KPI Bars */}
        <div className="bg-white border rounded-2xl p-6 mb-6" style={{ borderColor: 'var(--fg-border)' }}>
          <h3 className="font-mono text-[10px] font-bold tracking-widest uppercase mb-4" style={{ color: 'var(--fg-muted)' }}>Club Ratings</h3>
          <div className="space-y-3">
            {KPI_AVG_KEYS.map(key => (
              <KpiBar key={key} kpiKey={key} score={(club as any)[key]} size="lg" />
            ))}
          </div>
        </div>

        {/* Coaches */}
        <div>
          <h3 className="font-mono text-[10px] font-bold tracking-widest uppercase mb-4" style={{ color: 'var(--fg-muted)' }}>
            Coaches ({coaches.length})
          </h3>
          {coaches.length === 0 ? (
            <div className="bg-white border rounded-2xl p-8 text-center" style={{ borderColor: 'var(--fg-border)' }}>
              <div className="text-3xl mb-2">👤</div>
              <div className="font-semibold" style={{ color: 'var(--fg-text2)' }}>No coaches listed yet</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {coaches.map(c => <CoachCard key={c.id} coach={c} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
