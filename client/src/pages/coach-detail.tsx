import { useState, useEffect } from 'react'
import { useRoute } from 'wouter'
import { supabase } from '@/lib/supabase'
import type { Coach, Review } from '@/lib/types'
import { KPI_AVG_KEYS } from '@/lib/types'
import { Nav } from '@/components/layout/Nav'
import { RatingBadge } from '@/components/ui/RatingBadge'
import { KpiBar } from '@/components/ui/KpiBar'
import { fullName, initials, timeAgo } from '@/lib/fg-utils'
import { useAuth } from '@/hooks/use-auth'
import { useHead } from '@/hooks/use-head'
import { ClubBadge } from '@/components/ui/ClubBadge'

export default function CoachDetail() {
  const [, params] = useRoute('/coaches/:id')
  const id = params?.id
  const { user } = useAuth()
  const [coach, setCoach] = useState<Coach | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    async function load() {
      const [c, r] = await Promise.all([
        supabase.from('coaches').select('*, club:clubs(*)').eq('id', id).single(),
        supabase.from('reviews').select('*, reviewer:profiles(alias, alias_emoji, prefer_anonymous, first_name, last_name)').eq('coach_id', id).eq('status', 'approved').order('created_at', { ascending: false }).limit(20),
      ])
      setCoach(c.data as Coach | null)
      setReviews((r.data as Review[]) || [])
      setLoading(false)
    }
    load()
  }, [id])

  useHead(coach ? {
    title: `${coach.first_name} ${coach.last_name} - Coach Rating ${coach.avg_overall.toFixed(1)}/5 | Futbol Grade`,
    description: `${coach.first_name} ${coach.last_name} rated ${coach.avg_overall.toFixed(1)}/5 by the community. ${coach.total_reviews} review${coach.total_reviews !== 1 ? 's' : ''}. ${coach.city || 'SoCal'} youth soccer coach.`,
    url: `https://futbolgrade.com/coaches/${id}`,
  } : {})

  if (loading) return (
    <div style={{ background: 'var(--fg-bg)', minHeight: '100vh' }}>
      <Nav />
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-1/4" />
          <div className="space-y-3">{[1,2,3,4,5,6].map(i => <div key={i} className="h-6 bg-gray-200 rounded" />)}</div>
        </div>
      </div>
    </div>
  )

  if (!coach) return (
    <div style={{ background: 'var(--fg-bg)', minHeight: '100vh' }}>
      <Nav />
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <div className="text-4xl mb-3">⚽</div>
        <h2 className="font-bebas text-2xl" style={{ color: 'var(--fg-text)' }}>Coach Not Found</h2>
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
            <ClubBadge clubName={(coach.club as any)?.name} size="lg" />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-bebas text-2xl md:text-4xl tracking-[2px] leading-tight" style={{ color: 'var(--fg-text)' }} data-testid="coach-name">
                    {coach.first_name} {coach.last_name}
                  </h1>
                  {coach.user_id && (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-0.5 rounded-md border"
                      style={{ background: 'var(--fg-green-pale)', color: 'var(--fg-green)', borderColor: 'rgba(26,110,56,.2)' }}
                      data-testid="verified-badge">
                      ✓ VERIFIED
                    </span>
                  )}
                </div>
                <RatingBadge score={coach.avg_overall} size="xl" showGrade />
              </div>
              <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-1">
                {coach.club && (
                  <a href={`/clubs/${(coach.club as any).id}`} className="font-mono text-xs font-semibold hover:underline" style={{ color: 'var(--fg-green)' }}>
                    {(coach.club as any).name}
                  </a>
                )}
                <span className="font-mono text-xs" style={{ color: 'var(--fg-muted)' }}>📍 {coach.city || 'SoCal'}</span>
                {coach.age_groups?.length > 0 && (
                  <span className="font-mono text-[11px] px-2.5 py-0.5 rounded-md border font-semibold"
                    style={{ background: 'var(--fg-green-pale)', color: 'var(--fg-green)', borderColor: 'rgba(26,110,56,.2)' }}>
                    {coach.age_groups.join(' · ')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* KPI Bars */}
        <div className="bg-white border rounded-2xl p-6 mb-6" style={{ borderColor: 'var(--fg-border)' }}>
          <h3 className="font-mono text-[10px] font-bold tracking-widest uppercase mb-4" style={{ color: 'var(--fg-muted)' }}>Performance Ratings</h3>
          <div className="space-y-3">
            {KPI_AVG_KEYS.map(key => (
              <KpiBar key={key} kpiKey={key} score={(coach as any)[key]} size="lg" />
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          {user ? (
            <a
              href={`/coaches/${coach.id}/review`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110"
              style={{ background: 'var(--fg-green)', boxShadow: '0 4px 16px rgba(26,110,56,.25)' }}
              data-testid="write-review-btn"
            >
              ⭐ Write a Review
            </a>
          ) : (
            <a
              href="/auth/login"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110"
              style={{ background: 'var(--fg-green)', boxShadow: '0 4px 16px rgba(26,110,56,.25)' }}
              data-testid="login-to-review-btn"
            >
              Log in to Write a Review
            </a>
          )}
          {!coach.user_id && (
            <a
              href={`/coaches/${coach.id}/claim`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold border transition-all hover:brightness-95"
              style={{ color: 'var(--fg-green)', borderColor: 'var(--fg-green)', background: 'var(--fg-green-pale)' }}
              data-testid="claim-profile-btn"
            >
              🛡️ Is this you? Claim Profile
            </a>
          )}
        </div>

        {/* Reviews */}
        <div>
          <h3 className="font-mono text-[10px] font-bold tracking-widest uppercase mb-4" style={{ color: 'var(--fg-muted)' }}>
            Reviews ({reviews.length})
          </h3>
          {reviews.length === 0 ? (
            <div className="bg-white border rounded-2xl p-8 text-center" style={{ borderColor: 'var(--fg-border)' }}>
              <div className="text-3xl mb-2">📝</div>
              <div className="font-semibold" style={{ color: 'var(--fg-text2)' }}>No reviews yet</div>
              <div className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>Be the first to review this coach</div>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map(review => (
                <div key={review.id} className="bg-white border rounded-2xl p-5" style={{ borderColor: 'var(--fg-border)' }} data-testid={`review-${review.id}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg border"
                      style={{ background: 'var(--fg-green-pale)', borderColor: 'var(--fg-border)' }}>
                      {review.reviewer?.alias_emoji || '⚽'}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-sm" style={{ color: 'var(--fg-text)' }}>
                        {review.is_anonymous ? review.reviewer?.alias || 'Anonymous' : fullName(review.reviewer?.first_name || null, review.reviewer?.last_name || null)}
                      </div>
                      <div className="font-mono text-[10px]" style={{ color: 'var(--fg-muted)' }}>
                        {review.player_position && `${review.player_position} · `}{timeAgo(review.created_at)}
                      </div>
                    </div>
                    <RatingBadge score={(review.score_technical + review.score_team_building + review.score_development + review.score_approachability + review.score_professionalism + review.score_dedication) / 6} size="sm" />
                  </div>
                  {review.pros && review.pros.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {review.pros.filter(Boolean).map((p, i) => (
                        <span key={i} className="font-mono text-[11px] px-2.5 py-1 rounded-md border"
                          style={{ background: 'var(--fg-green-pale)', color: 'var(--fg-green)', borderColor: 'rgba(26,110,56,.2)' }}>
                          PRO: {p}
                        </span>
                      ))}
                    </div>
                  )}
                  {review.cons && review.cons.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {review.cons.filter(Boolean).map((c, i) => (
                        <span key={i} className="font-mono text-[11px] px-2.5 py-1 rounded-md border"
                          style={{ background: 'var(--fg-red-pale)', color: 'var(--fg-red)', borderColor: 'rgba(192,57,43,.2)' }}>
                          CON: {c}
                        </span>
                      ))}
                    </div>
                  )}
                  {review.body && (
                    <p className="text-sm leading-relaxed mt-2" style={{ color: 'var(--fg-text2)' }}>{review.body}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
