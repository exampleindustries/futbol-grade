import { useState, useEffect } from 'react'
import { useRoute } from 'wouter'
import { supabase } from '@/lib/supabase'
import { apiRequest } from '@/lib/queryClient'
import type { Coach } from '@/lib/types'
import { KPI_SCORE_KEYS, KPI_LABELS } from '@/lib/types'
import { Nav } from '@/components/layout/Nav'
import { generateAlias } from '@/lib/fg-utils'
import { useAuth } from '@/hooks/use-auth'

const POSITIONS = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward / Striker', 'Wing']
const DURATIONS = ['Less than 6 months', '6 months – 1 year', '1–2 years', '2–3 years', '3+ years']

export default function WriteReview() {
  const [, params] = useRoute('/coaches/:id/review')
  const coachId = params?.id
  const { user, profile, loading: authLoading } = useAuth()
  const [coach, setCoach] = useState<Coach | null>(null)
  const [loading, setLoading] = useState(true)

  const [isAnon, setIsAnon] = useState(true)
  const [alias, setAlias] = useState('')
  const [aliasEmoji, setAliasEmoji] = useState('⚽')
  const [scores, setScores] = useState<Record<string, number>>({})
  const [pros, setPros] = useState(['', '', ''])
  const [cons, setCons] = useState(['', '', ''])
  const [body, setBody] = useState('')
  const [position, setPosition] = useState('')
  const [duration, setDuration] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    const a = generateAlias()
    setAlias(a.name)
    setAliasEmoji(a.emoji)
  }, [])

  useEffect(() => {
    if (profile) {
      if (profile.alias) setAlias(profile.alias)
      if (profile.alias_emoji) setAliasEmoji(profile.alias_emoji)
      setIsAnon(profile.prefer_anonymous)
    }
  }, [profile])

  useEffect(() => {
    if (!coachId) return
    supabase.from('coaches').select('*, club:clubs(id, name, logo_url)').eq('id', coachId).single()
      .then(({ data }) => { setCoach(data as Coach | null); setLoading(false) })
  }, [coachId])

  if (authLoading || loading) return (
    <div style={{ background: 'var(--fg-bg)', minHeight: '100vh' }}><Nav />
      <div className="max-w-2xl mx-auto px-6 py-12"><div className="animate-pulse h-8 bg-gray-200 rounded w-1/2" /></div>
    </div>
  )

  if (!user) {
    window.location.href = '/auth/login'
    return null
  }

  if (!coach) return (
    <div style={{ background: 'var(--fg-bg)', minHeight: '100vh' }}><Nav />
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <div className="text-4xl mb-3">⚽</div><h2 className="font-bebas text-2xl" style={{ color: 'var(--fg-text)' }}>Coach Not Found</h2>
      </div>
    </div>
  )

  if (submitted) return (
    <div style={{ background: 'var(--fg-bg)', minHeight: '100vh' }}><Nav />
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="font-bebas text-3xl tracking-[2px] mb-2" style={{ color: 'var(--fg-text)' }}>Review Submitted</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--fg-muted)' }}>Your review will be published after moderation.</p>
        <a href={`/coaches/${coach.id}`} className="px-6 py-3 rounded-xl text-sm font-semibold text-white" style={{ background: 'var(--fg-green)' }}>
          Back to Coach →
        </a>
      </div>
    </div>
  )

  const allScored = KPI_SCORE_KEYS.every(k => scores[k] >= 1)
  const displayName = isAnon ? alias : `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || alias

  function regenAlias() {
    const a = generateAlias()
    setAlias(a.name)
    setAliasEmoji(a.emoji)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!allScored) { setError('Please rate all 6 categories'); return }
    setSubmitting(true)
    setError(null)

    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token
      await apiRequest('POST', '/api/reviews', {
        coach_id: coach.id,
        is_anonymous: isAnon,
        display_name: displayName,
        player_position: position || undefined,
        years_with_coach: duration || undefined,
        ...Object.fromEntries(KPI_SCORE_KEYS.map(k => [k, scores[k]])),
        pros: pros.filter(Boolean),
        cons: cons.filter(Boolean),
        body: body.trim() || undefined,
      })
      setSubmitted(true)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ background: 'var(--fg-bg)', minHeight: '100vh' }}>
      <Nav />
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        <div>
          <a href={`/coaches/${coach.id}`} className="font-mono text-xs" style={{ color: 'var(--fg-muted)' }}>← Back to coach</a>
          <h1 className="font-bebas text-2xl tracking-[2px] mt-2" style={{ color: 'var(--fg-text)' }}>
            REVIEW: {coach.first_name} {coach.last_name}
          </h1>
        </div>

        {/* Anonymous toggle */}
        <div className="bg-white border rounded-xl overflow-hidden" style={{ borderColor: 'var(--fg-border)' }}>
          <div className="px-5 py-3 flex items-center justify-between border-b" style={{ borderColor: 'var(--fg-border)', background: 'var(--fg-surface2)' }}>
            <span className="font-mono text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--fg-muted)' }}>Posting As</span>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm font-medium" style={{ color: 'var(--fg-text2)' }}>Anonymous</span>
              <div className="relative" onClick={() => setIsAnon(!isAnon)}>
                <div className="w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer"
                  style={{ background: isAnon ? 'var(--fg-green-light)' : 'var(--fg-border2)' }}>
                  <div className="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200"
                    style={{ transform: isAnon ? 'translateX(21px)' : 'translateX(4px)' }} />
                </div>
              </div>
            </label>
          </div>
          <div className="px-5 py-4 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl border"
              style={{ background: 'var(--fg-green-pale)', borderColor: 'var(--fg-border)' }}>{aliasEmoji}</div>
            <div className="flex-1">
              <div className="font-bold text-[15px]" style={{ color: 'var(--fg-text)' }}>{displayName}</div>
              <div className="text-xs font-mono mt-0.5" style={{ color: 'var(--fg-muted)' }}>
                {isAnon ? 'MLS-inspired alias · your real name is hidden' : 'Posting under your real name'}
              </div>
            </div>
            {isAnon && (
              <button type="button" onClick={regenAlias}
                className="font-mono text-xs px-3 py-1.5 rounded-lg border font-semibold"
                style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-text2)', background: 'var(--fg-surface2)' }}
                data-testid="regen-alias">↻ New Alias</button>
            )}
          </div>
        </div>

        {/* Context */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-mono text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--fg-muted)' }}>Player's Position</label>
            <select value={position} onChange={e => setPosition(e.target.value)}
              className="w-full border rounded-lg px-4 py-2.5 text-sm outline-none"
              style={{ borderColor: 'var(--fg-border2)', background: 'var(--fg-surface)', color: 'var(--fg-text)' }}
              data-testid="select-position">
              <option value="">Select…</option>
              {POSITIONS.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-mono text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--fg-muted)' }}>Years with Coach</label>
            <select value={duration} onChange={e => setDuration(e.target.value)}
              className="w-full border rounded-lg px-4 py-2.5 text-sm outline-none"
              style={{ borderColor: 'var(--fg-border2)', background: 'var(--fg-surface)', color: 'var(--fg-text)' }}
              data-testid="select-duration">
              <option value="">Select…</option>
              {DURATIONS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
        </div>

        {/* Star Ratings */}
        <div className="bg-white border rounded-xl p-5" style={{ borderColor: 'var(--fg-border)' }}>
          <div className="font-mono text-[10px] font-bold tracking-widest uppercase mb-4" style={{ color: 'var(--fg-muted)' }}>Rate Each Category (required)</div>
          <div className="space-y-4">
            {KPI_SCORE_KEYS.map(key => (
              <div key={key} className="flex items-center gap-4">
                <span className="text-sm font-medium w-44 flex-shrink-0" style={{ color: 'var(--fg-text2)' }}>{KPI_LABELS[key]}</span>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} type="button" onClick={() => setScores(s => ({ ...s, [key]: n }))}
                      className="text-2xl transition-all hover:scale-110 leading-none"
                      style={{ filter: (scores[key] || 0) >= n ? 'none' : 'grayscale(1) opacity(0.3)' }}
                      data-testid={`star-${key}-${n}`}>⭐</button>
                  ))}
                </div>
                {scores[key] && <span className="font-mono text-xs font-bold" style={{ color: 'var(--fg-green)' }}>{scores[key]}/5</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Pros */}
        <div>
          <label className="block font-mono text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--fg-muted)' }}>Pros (up to 3)</label>
          <div className="space-y-2">
            {pros.map((p, i) => (
              <div key={i} className="flex gap-2 items-center">
                <span className="font-mono text-[11px] font-bold px-2.5 py-1 rounded-md border flex-shrink-0"
                  style={{ background: 'var(--fg-green-pale)', color: 'var(--fg-green)', borderColor: 'rgba(26,110,56,.2)' }}>PRO</span>
                <input value={p} onChange={e => { const np = [...pros]; np[i] = e.target.value; setPros(np) }}
                  placeholder={i === 0 ? 'e.g. Great at developing player confidence' : 'Add another pro…'}
                  className="flex-1 border rounded-lg px-4 py-2.5 text-sm outline-none"
                  style={{ borderColor: 'var(--fg-border2)', background: 'var(--fg-surface)', color: 'var(--fg-text)' }}
                  data-testid={`pro-${i}`} />
              </div>
            ))}
          </div>
        </div>

        {/* Cons */}
        <div>
          <label className="block font-mono text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--fg-muted)' }}>Cons (up to 3)</label>
          <div className="space-y-2">
            {cons.map((c, i) => (
              <div key={i} className="flex gap-2 items-center">
                <span className="font-mono text-[11px] font-bold px-2.5 py-1 rounded-md border flex-shrink-0"
                  style={{ background: 'var(--fg-red-pale)', color: 'var(--fg-red)', borderColor: 'rgba(192,57,43,.2)' }}>CON</span>
                <input value={c} onChange={e => { const nc = [...cons]; nc[i] = e.target.value; setCons(nc) }}
                  placeholder={i === 0 ? 'e.g. Training sessions feel disorganized' : 'Add another con…'}
                  className="flex-1 border rounded-lg px-4 py-2.5 text-sm outline-none"
                  style={{ borderColor: 'var(--fg-border2)', background: 'var(--fg-surface)', color: 'var(--fg-text)' }}
                  data-testid={`con-${i}`} />
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div>
          <label className="block font-mono text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--fg-muted)' }}>Written Review (optional)</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Share more details about your experience…" rows={4}
            className="w-full border rounded-lg px-4 py-3 text-sm outline-none resize-y"
            style={{ borderColor: 'var(--fg-border2)', background: 'var(--fg-surface)', color: 'var(--fg-text)' }}
            data-testid="review-body" />
        </div>

        {error && (
          <div className="text-sm font-medium px-4 py-3 rounded-lg border"
            style={{ background: 'var(--fg-red-pale)', color: 'var(--fg-red)', borderColor: 'rgba(192,57,43,.2)' }}>{error}</div>
        )}

        <button type="submit" disabled={submitting || !allScored}
          className="w-full py-4 rounded-xl font-bold text-base text-white transition-all"
          style={{ background: allScored ? 'var(--fg-green-light)' : 'var(--fg-border2)', cursor: allScored ? 'pointer' : 'not-allowed' }}
          data-testid="submit-review">
          {submitting ? 'Submitting…' : 'Submit Review →'}
        </button>

        <p className="text-center text-xs font-mono" style={{ color: 'var(--fg-muted)' }}>
          Reviews are moderated before publishing · Your personal info is never shared
        </p>
      </form>
    </div>
  )
}
