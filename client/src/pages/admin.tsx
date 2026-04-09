import { useState, useEffect, useCallback } from 'react'
import { Nav } from '@/components/layout/Nav'
import { useAuth } from '@/hooks/use-auth'
import { RatingBadge } from '@/components/ui/RatingBadge'
import { apiRequest } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase'
import { timeAgo, fullName } from '@/lib/fg-utils'
import type { Review, Listing, CoachClaim } from '@/lib/types'

type Tab = 'reviews' | 'listings' | 'claims'
type ReviewFilter = 'pending' | 'approved' | 'rejected'
type ListingFilter = 'pending' | 'active' | 'removed'
type ClaimFilter = 'pending' | 'approved' | 'rejected'

interface Stats {
  reviews: { pending: number; approved: number; rejected: number }
  listings: { pending: number; active: number }
  claims: { pending: number }
}

export default function Admin() {
  const { user, profile, loading: authLoading } = useAuth()
  const [tab, setTab] = useState<Tab>('reviews')
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('pending')
  const [listingFilter, setListingFilter] = useState<ListingFilter>('pending')
  const [claimFilter, setClaimFilter] = useState<ClaimFilter>('pending')
  const [reviews, setReviews] = useState<(Review & { coach?: { id: string; first_name: string; last_name: string } })[]>([])
  const [listings, setListings] = useState<Listing[]>([])
  const [claims, setClaims] = useState<CoachClaim[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  async function getAuthHeader() {
    const { data: { session } } = await supabase.auth.getSession()
    return session ? `Bearer ${session.access_token}` : ''
  }

  const fetchStats = useCallback(async () => {
    try {
      const auth = await getAuthHeader()
      const res = await fetch(`${getApiBase()}/api/admin/stats`, { headers: { Authorization: auth } })
      if (res.ok) setStats(await res.json())
    } catch { /* ignore */ }
  }, [])

  const fetchReviews = useCallback(async (status: ReviewFilter) => {
    setLoading(true)
    try {
      const auth = await getAuthHeader()
      const res = await fetch(`${getApiBase()}/api/admin/reviews?status=${status}`, { headers: { Authorization: auth } })
      if (res.ok) setReviews(await res.json())
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  const fetchListings = useCallback(async (status: ListingFilter) => {
    setLoading(true)
    try {
      const auth = await getAuthHeader()
      const res = await fetch(`${getApiBase()}/api/admin/listings?status=${status}`, { headers: { Authorization: auth } })
      if (res.ok) setListings(await res.json())
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  const fetchClaims = useCallback(async (status: ClaimFilter) => {
    setLoading(true)
    try {
      const auth = await getAuthHeader()
      const res = await fetch(`${getApiBase()}/api/admin/claims?status=${status}`, { headers: { Authorization: auth } })
      if (res.ok) setClaims(await res.json())
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { if (profile?.is_admin) fetchStats() }, [profile, fetchStats])
  useEffect(() => { if (profile?.is_admin && tab === 'reviews') fetchReviews(reviewFilter) }, [profile, tab, reviewFilter, fetchReviews])
  useEffect(() => { if (profile?.is_admin && tab === 'listings') fetchListings(listingFilter) }, [profile, tab, listingFilter, fetchListings])
  useEffect(() => { if (profile?.is_admin && tab === 'claims') fetchClaims(claimFilter) }, [profile, tab, claimFilter, fetchClaims])

  async function handleReviewAction(id: string, action: 'approved' | 'rejected' | 'delete') {
    setActionLoading(id)
    try {
      const auth = await getAuthHeader()
      if (action === 'delete') {
        await fetch(`${getApiBase()}/api/admin/reviews/${id}`, { method: 'DELETE', headers: { Authorization: auth } })
      } else {
        await fetch(`${getApiBase()}/api/admin/reviews/${id}`, {
          method: 'PATCH', headers: { Authorization: auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: action }),
        })
      }
      await fetchReviews(reviewFilter)
      await fetchStats()
    } catch { /* ignore */ }
    setActionLoading(null)
  }

  async function handleClaimAction(id: string, action: 'approved' | 'rejected' | 'delete') {
    setActionLoading(id)
    try {
      const auth = await getAuthHeader()
      if (action === 'delete') {
        await fetch(`${getApiBase()}/api/admin/claims/${id}`, { method: 'DELETE', headers: { Authorization: auth } })
      } else {
        await fetch(`${getApiBase()}/api/admin/claims/${id}`, {
          method: 'PATCH', headers: { Authorization: auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: action }),
        })
      }
      await fetchClaims(claimFilter)
      await fetchStats()
    } catch { /* ignore */ }
    setActionLoading(null)
  }

  async function handleListingAction(id: string, action: 'active' | 'removed' | 'delete') {
    setActionLoading(id)
    try {
      const auth = await getAuthHeader()
      if (action === 'delete') {
        await fetch(`${getApiBase()}/api/admin/listings/${id}`, { method: 'DELETE', headers: { Authorization: auth } })
      } else {
        await fetch(`${getApiBase()}/api/admin/listings/${id}`, {
          method: 'PATCH', headers: { Authorization: auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: action }),
        })
      }
      await fetchListings(listingFilter)
      await fetchStats()
    } catch { /* ignore */ }
    setActionLoading(null)
  }

  // Gate: not logged in or not admin
  if (authLoading) return (
    <div style={{ background: 'var(--fg-bg)', minHeight: '100vh' }}>
      <Nav />
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-40" />
          <div className="h-4 bg-gray-200 rounded w-60" />
        </div>
      </div>
    </div>
  )

  if (!user || !profile?.is_admin) return (
    <div style={{ background: 'var(--fg-bg)', minHeight: '100vh' }}>
      <Nav />
      <div className="max-w-5xl mx-auto px-6 py-20 text-center">
        <div className="text-4xl mb-3">🔒</div>
        <h2 className="font-bebas text-2xl mb-2" style={{ color: 'var(--fg-text)' }}>Admin Only</h2>
        <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>You must be an admin to access this page.</p>
      </div>
    </div>
  )

  const avgScore = (r: Review) =>
    (r.score_technical + r.score_team_building + r.score_development + r.score_approachability + r.score_professionalism + r.score_dedication) / 6

  return (
    <div style={{ background: 'var(--fg-bg)', minHeight: '100vh' }}>
      <Nav />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6">
          <span className="font-mono text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--fg-muted)' }}>Moderation</span>
          <h1 className="font-bebas text-3xl tracking-[2px]" style={{ color: 'var(--fg-text)' }}>ADMIN</h1>
        </div>

        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
            <StatCard label="Pending Reviews" value={stats.reviews.pending} accent />
            <StatCard label="Approved Reviews" value={stats.reviews.approved} />
            <StatCard label="Pending Listings" value={stats.listings.pending} accent />
            <StatCard label="Active Listings" value={stats.listings.active} />
            <StatCard label="Pending Claims" value={stats.claims.pending} accent />
          </div>
        )}

        {/* Tab bar */}
        <div className="flex gap-2 mb-6">
          {(['reviews', 'listings', 'claims'] as Tab[]).map(t => {
            const count = stats ? (t === 'reviews' ? stats.reviews.pending : t === 'listings' ? stats.listings.pending : stats.claims.pending) : 0
            return (
              <button key={t} onClick={() => setTab(t)}
                className="font-mono text-xs font-semibold px-4 py-2 rounded-lg border transition-all capitalize"
                style={tab === t
                  ? { background: 'var(--fg-green)', color: 'white', borderColor: 'var(--fg-green)' }
                  : { background: 'var(--fg-surface)', color: 'var(--fg-text2)', borderColor: 'var(--fg-border2)' }}
                data-testid={`admin-tab-${t}`}>
                {t} {stats ? `(${count})` : ''}
              </button>
            )
          })}
        </div>

        {/* Reviews tab */}
        {tab === 'reviews' && (
          <>
            <FilterBar<ReviewFilter>
              options={[
                { value: 'pending', label: 'Pending' },
                { value: 'approved', label: 'Approved' },
                { value: 'rejected', label: 'Rejected' },
              ]}
              value={reviewFilter}
              onChange={setReviewFilter}
            />
            {loading ? <Skeleton /> : reviews.length === 0 ? (
              <EmptyState text={`No ${reviewFilter} reviews`} />
            ) : (
              <div className="space-y-3">
                {reviews.map(r => (
                  <div key={r.id} className="bg-white border rounded-xl p-4 sm:p-5" style={{ borderColor: 'var(--fg-border)' }} data-testid={`admin-review-${r.id}`}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm">{r.reviewer?.alias_emoji || '⚽'}</span>
                          <span className="font-semibold text-sm" style={{ color: 'var(--fg-text)' }}>
                            {r.is_anonymous ? r.reviewer?.alias || 'Anonymous' : 'Named reviewer'}
                          </span>
                          <span className="font-mono text-[10px]" style={{ color: 'var(--fg-muted)' }}>→</span>
                          <a href={`#/coaches/${r.coach_id}`} className="font-mono text-xs font-semibold hover:underline" style={{ color: 'var(--fg-green)' }}>
                            {r.coach ? `${r.coach.first_name} ${r.coach.last_name}` : r.coach_id.slice(0, 8)}
                          </a>
                        </div>
                        <div className="font-mono text-[10px]" style={{ color: 'var(--fg-muted)' }}>
                          {timeAgo(r.created_at)} · {r.player_position || 'No position'}
                        </div>
                      </div>
                      <RatingBadge score={avgScore(r)} size="sm" />
                    </div>

                    {/* Scores compact */}
                    <div className="flex flex-wrap gap-2 mb-2">
                      {[
                        ['Tech', r.score_technical], ['Team', r.score_team_building], ['Dev', r.score_development],
                        ['Appch', r.score_approachability], ['Prof', r.score_professionalism], ['Ded', r.score_dedication],
                      ].map(([l, v]) => (
                        <span key={l as string} className="font-mono text-[10px] px-2 py-0.5 rounded border"
                          style={{ borderColor: 'var(--fg-border)', color: 'var(--fg-text2)' }}>
                          {l}: {(v as number).toFixed(1)}
                        </span>
                      ))}
                    </div>

                    {r.pros?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1">
                        {r.pros.filter(Boolean).map((p, i) => (
                          <span key={i} className="font-mono text-[10px] px-2 py-0.5 rounded-md"
                            style={{ background: 'var(--fg-green-pale)', color: 'var(--fg-green)' }}>+{p}</span>
                        ))}
                      </div>
                    )}
                    {r.cons?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1">
                        {r.cons.filter(Boolean).map((c, i) => (
                          <span key={i} className="font-mono text-[10px] px-2 py-0.5 rounded-md"
                            style={{ background: 'var(--fg-red-pale)', color: 'var(--fg-red)' }}>-{c}</span>
                        ))}
                      </div>
                    )}
                    {r.body && <p className="text-sm mt-2 mb-3 leading-relaxed" style={{ color: 'var(--fg-text2)' }}>{r.body}</p>}

                    {/* Actions */}
                    <div className="flex gap-2 pt-3 border-t" style={{ borderColor: 'var(--fg-border)' }}>
                      {reviewFilter !== 'approved' && (
                        <ActionBtn label="Approve" color="green" loading={actionLoading === r.id} onClick={() => handleReviewAction(r.id, 'approved')} />
                      )}
                      {reviewFilter !== 'rejected' && (
                        <ActionBtn label="Reject" color="amber" loading={actionLoading === r.id} onClick={() => handleReviewAction(r.id, 'rejected')} />
                      )}
                      <ActionBtn label="Delete" color="red" loading={actionLoading === r.id} onClick={() => handleReviewAction(r.id, 'delete')} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Listings tab */}
        {tab === 'listings' && (
          <>
            <FilterBar<ListingFilter>
              options={[
                { value: 'pending', label: 'Pending' },
                { value: 'active', label: 'Active' },
                { value: 'removed', label: 'Removed' },
              ]}
              value={listingFilter}
              onChange={setListingFilter}
            />
            {loading ? <Skeleton /> : listings.length === 0 ? (
              <EmptyState text={`No ${listingFilter} listings`} />
            ) : (
              <div className="space-y-3">
                {listings.map(l => (
                  <div key={l.id} className="bg-white border rounded-xl p-4 sm:p-5" style={{ borderColor: 'var(--fg-border)' }} data-testid={`admin-listing-${l.id}`}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate" style={{ color: 'var(--fg-text)' }}>{l.title}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded border"
                            style={{ background: 'var(--fg-green-pale)', color: 'var(--fg-green)', borderColor: 'rgba(26,110,56,.2)' }}>
                            {l.type}
                          </span>
                          <span className="font-mono text-[10px]" style={{ color: 'var(--fg-muted)' }}>
                            by {l.seller?.alias_emoji || '⚽'} {l.seller?.alias || 'Seller'} · {timeAgo(l.created_at)}
                          </span>
                        </div>
                      </div>
                      <div className="font-bebas text-lg" style={{ color: 'var(--fg-green)' }}>
                        {l.price_cents ? `$${(l.price_cents / 100).toFixed(0)}` : l.price_text || 'Free'}
                      </div>
                    </div>
                    {l.description && <p className="text-sm mb-3 line-clamp-2" style={{ color: 'var(--fg-text2)' }}>{l.description}</p>}

                    <div className="flex gap-2 pt-3 border-t" style={{ borderColor: 'var(--fg-border)' }}>
                      {listingFilter !== 'active' && (
                        <ActionBtn label="Approve" color="green" loading={actionLoading === l.id} onClick={() => handleListingAction(l.id, 'active')} />
                      )}
                      {listingFilter !== 'removed' && (
                        <ActionBtn label="Remove" color="amber" loading={actionLoading === l.id} onClick={() => handleListingAction(l.id, 'removed')} />
                      )}
                      <ActionBtn label="Delete" color="red" loading={actionLoading === l.id} onClick={() => handleListingAction(l.id, 'delete')} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Claims tab */}
        {tab === 'claims' && (
          <>
            <FilterBar<ClaimFilter>
              options={[
                { value: 'pending', label: 'Pending' },
                { value: 'approved', label: 'Approved' },
                { value: 'rejected', label: 'Rejected' },
              ]}
              value={claimFilter}
              onChange={setClaimFilter}
            />
            {loading ? <Skeleton /> : claims.length === 0 ? (
              <EmptyState text={`No ${claimFilter} claims`} />
            ) : (
              <div className="space-y-3">
                {claims.map(c => (
                  <div key={c.id} className="bg-white border rounded-xl p-4 sm:p-5" style={{ borderColor: 'var(--fg-border)' }} data-testid={`admin-claim-${c.id}`}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm">{c.claimant?.alias_emoji || '⚽'}</span>
                          <span className="font-semibold text-sm" style={{ color: 'var(--fg-text)' }}>
                            {c.claimant?.alias || 'User'}
                          </span>
                          <span className="font-mono text-[10px]" style={{ color: 'var(--fg-muted)' }}>→ claims</span>
                          <a href={`#/coaches/${c.coach_id}`} className="font-mono text-xs font-semibold hover:underline" style={{ color: 'var(--fg-green)' }}>
                            {c.coach ? `${c.coach.first_name} ${c.coach.last_name}` : c.coach_id.slice(0, 8)}
                          </a>
                        </div>
                        <div className="font-mono text-[10px]" style={{ color: 'var(--fg-muted)' }}>
                          {timeAgo(c.created_at)}
                        </div>
                      </div>
                    </div>

                    {/* Claim details */}
                    <div className="flex flex-wrap gap-2 mb-2">
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded border"
                        style={{ borderColor: 'var(--fg-border)', color: 'var(--fg-text2)' }}>
                        Email: {c.email}
                      </span>
                      {c.phone && (
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded border"
                          style={{ borderColor: 'var(--fg-border)', color: 'var(--fg-text2)' }}>
                          Phone: {c.phone}
                        </span>
                      )}
                      {c.license_number && (
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded border"
                          style={{ borderColor: 'var(--fg-border)', color: 'var(--fg-text2)' }}>
                          License: {c.license_number}
                        </span>
                      )}
                    </div>
                    {c.verification_note && (
                      <p className="text-sm mt-2 mb-3 leading-relaxed" style={{ color: 'var(--fg-text2)' }}>{c.verification_note}</p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-3 border-t" style={{ borderColor: 'var(--fg-border)' }}>
                      {claimFilter !== 'approved' && (
                        <ActionBtn label="Approve" color="green" loading={actionLoading === c.id} onClick={() => handleClaimAction(c.id, 'approved')} />
                      )}
                      {claimFilter !== 'rejected' && (
                        <ActionBtn label="Reject" color="amber" loading={actionLoading === c.id} onClick={() => handleClaimAction(c.id, 'rejected')} />
                      )}
                      <ActionBtn label="Delete" color="red" loading={actionLoading === c.id} onClick={() => handleClaimAction(c.id, 'delete')} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────

function getApiBase() {
  const base = "__PORT_5000__"
  return base.startsWith("__") ? "" : base
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="bg-white border rounded-xl p-4" style={{ borderColor: accent && value > 0 ? 'var(--fg-green)' : 'var(--fg-border)' }}>
      <div className="font-bebas text-2xl" style={{ color: accent && value > 0 ? 'var(--fg-green)' : 'var(--fg-text)' }}>{value}</div>
      <div className="font-mono text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--fg-muted)' }}>{label}</div>
    </div>
  )
}

function FilterBar<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1.5 mb-4 overflow-x-auto">
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className="font-mono text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all whitespace-nowrap"
          style={value === o.value
            ? { background: 'var(--fg-text)', color: 'white', borderColor: 'var(--fg-text)' }
            : { background: 'var(--fg-surface)', color: 'var(--fg-muted)', borderColor: 'var(--fg-border)' }}
          data-testid={`filter-${o.value}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function ActionBtn({ label, color, loading, onClick }: { label: string; color: 'green' | 'amber' | 'red'; loading: boolean; onClick: () => void }) {
  const colors = {
    green: { bg: 'var(--fg-green)', text: 'white' },
    amber: { bg: '#f59e0b', text: 'white' },
    red: { bg: 'var(--fg-red)', text: 'white' },
  }
  return (
    <button onClick={onClick} disabled={loading}
      className="font-mono text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
      style={{ background: colors[color].bg, color: colors[color].text }}
      data-testid={`action-${label.toLowerCase()}`}>
      {loading ? '...' : label}
    </button>
  )
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => <div key={i} className="bg-white border rounded-xl p-5 h-32 animate-pulse" style={{ borderColor: 'var(--fg-border)' }} />)}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="bg-white border rounded-xl p-12 text-center" style={{ borderColor: 'var(--fg-border)' }}>
      <div className="text-3xl mb-2">📋</div>
      <div className="font-semibold" style={{ color: 'var(--fg-text2)' }}>{text}</div>
      <div className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>Nothing to moderate here</div>
    </div>
  )
}
