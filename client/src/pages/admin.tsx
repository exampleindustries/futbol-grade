import { useState, useEffect, useCallback } from 'react'
import { Nav } from '@/components/layout/Nav'
import { useAuth } from '@/hooks/use-auth'
import { RatingBadge } from '@/components/ui/RatingBadge'
import { apiRequest } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase'
import { timeAgo, fullName } from '@/lib/fg-utils'
import type { Review, Listing, CoachClaim, Coach } from '@/lib/types'

function AdminLoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      // Auth state change will trigger re-render with user set
    } catch (err: any) {
      setError(err.message || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block font-mono text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--fg-muted)' }}>Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
          className="w-full border rounded-lg px-4 py-2.5 text-sm outline-none"
          style={{ borderColor: 'var(--fg-border2)', background: 'var(--fg-surface)', color: 'var(--fg-text)' }}
          data-testid="admin-login-email" />
      </div>
      <div>
        <label className="block font-mono text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--fg-muted)' }}>Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
          className="w-full border rounded-lg px-4 py-2.5 text-sm outline-none"
          style={{ borderColor: 'var(--fg-border2)', background: 'var(--fg-surface)', color: 'var(--fg-text)' }}
          data-testid="admin-login-password" />
      </div>
      <div className="text-right">
        <a href="/auth/forgot-password" className="font-mono text-[11px] font-semibold hover:underline" style={{ color: 'var(--fg-green)' }}>Forgot password?</a>
      </div>
      {error && (
        <div className="text-sm font-medium px-4 py-3 rounded-lg border"
          style={{ background: 'var(--fg-red-pale)', color: 'var(--fg-red)', borderColor: 'rgba(192,57,43,.2)' }}>{error}</div>
      )}
      <button type="submit" disabled={loading}
        className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all"
        style={{ background: 'var(--fg-green)' }}
        data-testid="admin-login-submit">
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  )
}

type Tab = 'reviews' | 'listings' | 'claims' | 'imports' | 'users' | 'clubs'

interface AdminClub {
  id: string
  name: string
  city: string
  state: string
  logo_url: string | null
  status: string
  coach_count: number
  avg_overall: number
}

interface AdminUser {
  id: string
  alias: string
  alias_emoji: string
  email: string | null
  is_admin: boolean
  is_banned: boolean
  review_count: number
  listing_count: number
  created_at: string
}
type ReviewFilter = 'pending' | 'approved' | 'rejected'
type ListingFilter = 'pending' | 'active' | 'removed'
type ClaimFilter = 'pending' | 'approved' | 'rejected'

type ImportFilter = 'pending' | 'approved' | 'rejected'

interface Stats {
  reviews: { pending: number; approved: number; rejected: number }
  listings: { pending: number; active: number }
  claims: { pending: number }
  imports: { pending: number }
}

export default function Admin() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth()

  // Always re-fetch profile on admin page load to avoid stale cache
  useEffect(() => { refreshProfile() }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  const [tab, setTab] = useState<Tab>('reviews')
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('pending')
  const [listingFilter, setListingFilter] = useState<ListingFilter>('pending')
  const [claimFilter, setClaimFilter] = useState<ClaimFilter>('pending')
  const [importFilter, setImportFilter] = useState<ImportFilter>('pending')
  const [reviews, setReviews] = useState<(Review & { coach?: { id: string; first_name: string; last_name: string } })[]>([])
  const [listings, setListings] = useState<Listing[]>([])
  const [claims, setClaims] = useState<CoachClaim[]>([])
  const [imports, setImports] = useState<(Coach & { club?: { id: string; name: string; city: string } })[]>([])
  const [selectedImports, setSelectedImports] = useState<Set<string>>(new Set())
  const [users, setUsers] = useState<AdminUser[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [adminClubs, setAdminClubs] = useState<AdminClub[]>([])
  const [uploadingLogo, setUploadingLogo] = useState<string | null>(null)
  const [editingClub, setEditingClub] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editCity, setEditCity] = useState('')
  const [editState, setEditState] = useState('')
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

  const fetchImports = useCallback(async (status: ImportFilter) => {
    setLoading(true)
    try {
      const auth = await getAuthHeader()
      const res = await fetch(`${getApiBase()}/api/admin/coaches?status=${status}`, { headers: { Authorization: auth } })
      if (res.ok) { setImports(await res.json()); setSelectedImports(new Set()) }
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  const fetchClubs = useCallback(async () => {
    setLoading(true)
    try {
      const auth = await getAuthHeader()
      const res = await fetch(`${getApiBase()}/api/admin/clubs`, { headers: { Authorization: auth } })
      if (res.ok) setAdminClubs(await res.json())
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  const fetchUsers = useCallback(async (search?: string) => {
    setLoading(true)
    try {
      const auth = await getAuthHeader()
      const q = search ? `?search=${encodeURIComponent(search)}` : ''
      const res = await fetch(`${getApiBase()}/api/admin/users${q}`, { headers: { Authorization: auth } })
      if (res.ok) setUsers(await res.json())
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { if (profile?.is_admin) fetchStats() }, [profile, fetchStats])
  useEffect(() => { if (profile?.is_admin && tab === 'reviews') fetchReviews(reviewFilter) }, [profile, tab, reviewFilter, fetchReviews])
  useEffect(() => { if (profile?.is_admin && tab === 'listings') fetchListings(listingFilter) }, [profile, tab, listingFilter, fetchListings])
  useEffect(() => { if (profile?.is_admin && tab === 'claims') fetchClaims(claimFilter) }, [profile, tab, claimFilter, fetchClaims])
  useEffect(() => { if (profile?.is_admin && tab === 'imports') fetchImports(importFilter) }, [profile, tab, importFilter, fetchImports])
  useEffect(() => { if (profile?.is_admin && tab === 'users') fetchUsers() }, [profile, tab, fetchUsers])
  useEffect(() => { if (profile?.is_admin && tab === 'clubs') fetchClubs() }, [profile, tab, fetchClubs])

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

  async function handleImportAction(id: string, action: 'approved' | 'rejected' | 'delete') {
    setActionLoading(id)
    try {
      const auth = await getAuthHeader()
      if (action === 'delete') {
        await fetch(`${getApiBase()}/api/admin/coaches/${id}`, { method: 'DELETE', headers: { Authorization: auth } })
      } else {
        await fetch(`${getApiBase()}/api/admin/coaches/${id}`, {
          method: 'PATCH', headers: { Authorization: auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: action }),
        })
      }
      await fetchImports(importFilter)
      await fetchStats()
    } catch { /* ignore */ }
    setActionLoading(null)
  }

  async function handleLogoUpload(clubId: string, clubName: string, file: File) {
    setUploadingLogo(clubId)
    try {
      const ext = file.name.split('.').pop() || 'png'
      const path = `${clubId}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('club-logos').upload(path, file, { upsert: true, contentType: file.type })
      if (uploadErr) throw uploadErr
      const { data: urlData } = supabase.storage.from('club-logos').getPublicUrl(path)
      const logoUrl = urlData.publicUrl + '?v=' + Date.now()
      // Update club record
      const auth = await getAuthHeader()
      await fetch(`${getApiBase()}/api/admin/clubs/${clubId}`, {
        method: 'PATCH', headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ logo_url: logoUrl }),
      })
      await fetchClubs()
    } catch (err: any) {
      alert('Upload failed: ' + (err.message || 'Unknown error'))
    }
    setUploadingLogo(null)
  }

  async function handleClubUpdate(clubId: string, field: string, value: string) {
    try {
      const auth = await getAuthHeader()
      await fetch(`${getApiBase()}/api/admin/clubs/${clubId}`, {
        method: 'PATCH', headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      await fetchClubs()
    } catch { /* ignore */ }
  }

  async function handleUserAction(userId: string, field: 'is_admin' | 'is_banned', value: boolean) {
    setActionLoading(userId)
    try {
      const auth = await getAuthHeader()
      await fetch(`${getApiBase()}/api/admin/users/${userId}`, {
        method: 'PATCH', headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      await fetchUsers(userSearch || undefined)
    } catch { /* ignore */ }
    setActionLoading(null)
  }

  async function handleBulkImport(action: 'approved' | 'rejected') {
    if (!selectedImports.size) return
    setActionLoading('bulk')
    try {
      const auth = await getAuthHeader()
      await fetch(`${getApiBase()}/api/admin/coaches/bulk`, {
        method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedImports), status: action }),
      })
      await fetchImports(importFilter)
      await fetchStats()
    } catch { /* ignore */ }
    setActionLoading(null)
  }

  function toggleImportSelect(id: string) {
    setSelectedImports(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleAllImports(clubCoaches: typeof imports) {
    const allSelected = clubCoaches.every(c => selectedImports.has(c.id))
    setSelectedImports(prev => {
      const next = new Set(prev)
      clubCoaches.forEach(c => allSelected ? next.delete(c.id) : next.add(c.id))
      return next
    })
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

  if (!user) return (
    <div style={{ background: 'var(--fg-bg)', minHeight: '100vh' }}>
      <Nav />
      <div className="max-w-md mx-auto px-6 py-16">
        <div className="bg-white border rounded-2xl p-8" style={{ borderColor: 'var(--fg-border)' }}>
          <div className="text-center mb-6">
            <div className="text-3xl mb-2">🔒</div>
            <h1 className="font-bebas text-3xl tracking-[2px]" style={{ color: 'var(--fg-text)' }}>ADMIN LOGIN</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>Sign in with your admin credentials</p>
          </div>
          <AdminLoginForm />
        </div>
      </div>
    </div>
  )

  if (!profile?.is_admin) return (
    <div style={{ background: 'var(--fg-bg)', minHeight: '100vh' }}>
      <Nav />
      <div className="max-w-5xl mx-auto px-6 py-20 text-center">
        <div className="text-4xl mb-3">🚫</div>
        <h2 className="font-bebas text-2xl mb-2" style={{ color: 'var(--fg-text)' }}>Access Denied</h2>
        <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>This account does not have admin privileges.</p>
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
            <StatCard label="Pending Imports" value={stats.imports.pending} accent />
            <StatCard label="Total Users" value={users.length || 0} />
          </div>
        )}

        {/* Tab bar */}
        <div className="flex gap-2 mb-6">
          {(['reviews', 'listings', 'claims', 'imports', 'users', 'clubs'] as Tab[]).map(t => {
            const count = stats ? (t === 'reviews' ? stats.reviews.pending : t === 'listings' ? stats.listings.pending : t === 'claims' ? stats.claims.pending : t === 'imports' ? stats.imports.pending : t === 'users' ? users.length : adminClubs.length) : 0
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
                          <a href={`/coaches/${r.coach_id}`} className="font-mono text-xs font-semibold hover:underline" style={{ color: 'var(--fg-green)' }}>
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
                          <a href={`/coaches/${c.coach_id}`} className="font-mono text-xs font-semibold hover:underline" style={{ color: 'var(--fg-green)' }}>
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
        {/* Clubs tab */}
        {tab === 'clubs' && (
          <>
            {loading ? <Skeleton /> : adminClubs.length === 0 ? (
              <EmptyState text="No clubs found" />
            ) : (
              <div className="space-y-3">
                {adminClubs.map(c => (
                  <div key={c.id} className="bg-white border rounded-xl p-4 sm:p-5 flex items-center gap-4" style={{ borderColor: 'var(--fg-border)' }} data-testid={`admin-club-${c.id}`}>
                    {/* Logo */}
                    <div className="flex-shrink-0">
                      {c.logo_url ? (
                        <img src={c.logo_url} alt={c.name} className="w-14 h-14 rounded-xl object-contain border" style={{ borderColor: 'var(--fg-border)' }} />
                      ) : (
                        <div className="w-14 h-14 rounded-xl flex items-center justify-center border-2 border-dashed" style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-muted)' }}>
                          <span className="text-[10px] font-mono">No logo</span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      {editingClub === c.id ? (
                        <div className="space-y-2">
                          <div>
                            <label className="font-mono text-[9px] font-bold tracking-widest uppercase" style={{ color: 'var(--fg-muted)' }}>Name</label>
                            <input value={editName} onChange={e => setEditName(e.target.value)}
                              className="w-full border rounded-lg px-3 py-1.5 text-sm outline-none mt-0.5"
                              style={{ borderColor: 'var(--fg-border2)', background: 'var(--fg-surface)', color: 'var(--fg-text)' }} />
                          </div>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label className="font-mono text-[9px] font-bold tracking-widest uppercase" style={{ color: 'var(--fg-muted)' }}>City</label>
                              <input value={editCity} onChange={e => setEditCity(e.target.value)}
                                className="w-full border rounded-lg px-3 py-1.5 text-sm outline-none mt-0.5"
                                style={{ borderColor: 'var(--fg-border2)', background: 'var(--fg-surface)', color: 'var(--fg-text)' }} />
                            </div>
                            <div className="w-20">
                              <label className="font-mono text-[9px] font-bold tracking-widest uppercase" style={{ color: 'var(--fg-muted)' }}>State</label>
                              <input value={editState} onChange={e => setEditState(e.target.value)}
                                className="w-full border rounded-lg px-3 py-1.5 text-sm outline-none mt-0.5"
                                style={{ borderColor: 'var(--fg-border2)', background: 'var(--fg-surface)', color: 'var(--fg-text)' }} />
                            </div>
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button onClick={async () => {
                              const auth = await getAuthHeader()
                              await fetch(`${getApiBase()}/api/admin/clubs/${c.id}`, {
                                method: 'PATCH', headers: { Authorization: auth, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ name: editName, city: editCity, state: editState }),
                              })
                              setEditingClub(null)
                              await fetchClubs()
                            }} className="font-mono text-[10px] font-bold px-3 py-1 rounded-lg text-white" style={{ background: 'var(--fg-green)' }}>Save</button>
                            <button onClick={() => setEditingClub(null)} className="font-mono text-[10px] font-bold px-3 py-1 rounded-lg border" style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-text2)' }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="font-semibold text-sm" style={{ color: 'var(--fg-text)' }}>{c.name}</div>
                          <div className="flex flex-wrap gap-2 mt-1">
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded border" style={{ borderColor: 'var(--fg-border)', color: 'var(--fg-text2)' }}>
                              {c.city}, {c.state}
                            </span>
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded border" style={{ borderColor: 'var(--fg-border)', color: 'var(--fg-muted)' }}>
                              {c.coach_count} coach{c.coach_count !== 1 ? 'es' : ''}
                            </span>
                            {c.avg_overall > 0 && (
                              <span className="font-mono text-[10px] px-2 py-0.5 rounded border" style={{ borderColor: 'var(--fg-border)', color: 'var(--fg-green)' }}>
                                ★ {c.avg_overall.toFixed(1)}
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 flex-shrink-0 items-end">
                      <label className="cursor-pointer">
                        <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0]
                            if (file) handleLogoUpload(c.id, c.name, file)
                            e.target.value = ''
                          }} />
                        <span className="font-mono text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all hover:bg-gray-50 inline-block"
                          style={{ borderColor: 'var(--fg-border2)', color: uploadingLogo === c.id ? 'var(--fg-muted)' : 'var(--fg-green)' }}>
                          {uploadingLogo === c.id ? 'Uploading...' : c.logo_url ? 'Replace Logo' : 'Upload Logo'}
                        </span>
                      </label>
                      {editingClub !== c.id && (
                        <button onClick={() => { setEditingClub(c.id); setEditName(c.name); setEditCity(c.city); setEditState(c.state) }}
                          className="font-mono text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all hover:bg-gray-50"
                          style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-text2)' }}>
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Users tab */}
        {tab === 'users' && (
          <>
            <form onSubmit={e => { e.preventDefault(); fetchUsers(userSearch || undefined) }} className="flex gap-3 mb-6">
              <input type="search" value={userSearch} onChange={e => setUserSearch(e.target.value)}
                placeholder="Search by alias..."
                className="flex-1 border rounded-lg px-4 py-2.5 text-sm outline-none max-w-xs"
                style={{ borderColor: 'var(--fg-border2)', background: 'var(--fg-surface)', color: 'var(--fg-text)' }}
                data-testid="user-search" />
              <button type="submit" className="font-mono text-xs font-semibold px-4 py-2 rounded-lg border transition-all hover:bg-gray-50"
                style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-text2)' }}>Search</button>
            </form>

            {loading ? <Skeleton /> : users.length === 0 ? (
              <EmptyState text="No users found" />
            ) : (
              <div className="bg-white border rounded-xl overflow-hidden" style={{ borderColor: 'var(--fg-border)' }}>
                {/* Table header */}
                <div className="hidden sm:grid sm:grid-cols-12 gap-2 px-5 py-3 border-b font-mono text-[10px] font-bold tracking-widest uppercase"
                  style={{ borderColor: 'var(--fg-border)', color: 'var(--fg-muted)', background: 'var(--fg-surface)' }}>
                  <div className="col-span-3">User</div>
                  <div className="col-span-3">Email</div>
                  <div className="col-span-1 text-center">Reviews</div>
                  <div className="col-span-1 text-center">Listings</div>
                  <div className="col-span-1 text-center">Role</div>
                  <div className="col-span-3 text-right">Actions</div>
                </div>

                <div className="divide-y" style={{ borderColor: 'var(--fg-border)' }}>
                  {users.map(u => (
                    <div key={u.id} className="sm:grid sm:grid-cols-12 gap-2 items-center px-4 sm:px-5 py-3" data-testid={`user-${u.id}`}>
                      {/* User */}
                      <div className="col-span-3 flex items-center gap-2 min-w-0 mb-2 sm:mb-0">
                        <span className="text-sm">{u.alias_emoji || '⚽'}</span>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate" style={{ color: u.is_banned ? 'var(--fg-red)' : 'var(--fg-text)' }}>
                            {u.alias || 'Anonymous'}
                            {u.is_banned && <span className="font-mono text-[9px] ml-1 px-1 py-0.5 rounded" style={{ background: 'var(--fg-red-pale)', color: 'var(--fg-red)' }}>BANNED</span>}
                          </div>
                          <div className="font-mono text-[10px]" style={{ color: 'var(--fg-muted)' }}>{timeAgo(u.created_at)}</div>
                        </div>
                      </div>

                      {/* Email */}
                      <div className="col-span-3 font-mono text-[11px] truncate mb-2 sm:mb-0" style={{ color: 'var(--fg-text2)' }}>
                        {u.email || '—'}
                      </div>

                      {/* Reviews */}
                      <div className="col-span-1 text-center font-mono text-xs font-bold" style={{ color: u.review_count ? 'var(--fg-green)' : 'var(--fg-muted)' }}>
                        {u.review_count}
                      </div>

                      {/* Listings */}
                      <div className="col-span-1 text-center font-mono text-xs font-bold" style={{ color: u.listing_count ? 'var(--fg-green)' : 'var(--fg-muted)' }}>
                        {u.listing_count}
                      </div>

                      {/* Role */}
                      <div className="col-span-1 text-center">
                        {u.is_admin ? (
                          <span className="font-mono text-[9px] font-bold px-2 py-0.5 rounded" style={{ background: 'var(--fg-green-pale)', color: 'var(--fg-green)' }}>ADMIN</span>
                        ) : (
                          <span className="font-mono text-[9px]" style={{ color: 'var(--fg-muted)' }}>user</span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="col-span-3 flex gap-2 justify-end mt-2 sm:mt-0">
                        {u.is_admin ? (
                          <ActionBtn label="Demote" color="amber" loading={actionLoading === u.id}
                            onClick={() => handleUserAction(u.id, 'is_admin', false)} />
                        ) : (
                          <ActionBtn label="Promote" color="green" loading={actionLoading === u.id}
                            onClick={() => handleUserAction(u.id, 'is_admin', true)} />
                        )}
                        {u.is_banned ? (
                          <ActionBtn label="Unban" color="green" loading={actionLoading === u.id}
                            onClick={() => handleUserAction(u.id, 'is_banned', false)} />
                        ) : (
                          <ActionBtn label="Ban" color="red" loading={actionLoading === u.id}
                            onClick={() => handleUserAction(u.id, 'is_banned', true)} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Imports tab */}
        {tab === 'imports' && (
          <>
            <FilterBar<ImportFilter>
              options={[
                { value: 'pending', label: 'Pending' },
                { value: 'approved', label: 'Approved' },
                { value: 'rejected', label: 'Rejected' },
              ]}
              value={importFilter}
              onChange={setImportFilter}
            />

            {importFilter === 'pending' && imports.length > 0 && (
              <div className="flex gap-2 mb-4">
                <span className="font-mono text-[10px] py-2" style={{ color: 'var(--fg-muted)' }}>
                  {selectedImports.size} selected
                </span>
                <ActionBtn label={`Approve ${selectedImports.size}`} color="green" loading={actionLoading === 'bulk'}
                  onClick={() => handleBulkImport('approved')} />
                <ActionBtn label={`Reject ${selectedImports.size}`} color="amber" loading={actionLoading === 'bulk'}
                  onClick={() => handleBulkImport('rejected')} />
              </div>
            )}

            {loading ? <Skeleton /> : imports.length === 0 ? (
              <EmptyState text={`No ${importFilter} coach imports`} />
            ) : (
              <div className="space-y-6">
                {/* Group by club */}
                {Object.entries(
                  imports.reduce<Record<string, typeof imports>>((acc, c) => {
                    const clubName = c.club ? `${c.club.name} — ${c.club.city}` : 'No Club'
                    if (!acc[clubName]) acc[clubName] = []
                    acc[clubName].push(c)
                    return acc
                  }, {})
                ).map(([clubName, clubCoaches]) => (
                  <div key={clubName} className="bg-white border rounded-xl overflow-hidden" style={{ borderColor: 'var(--fg-border)' }}>
                    {/* Club header */}
                    <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b" style={{ borderColor: 'var(--fg-border)', background: 'var(--fg-green-pale)' }}>
                      <div className="flex items-center gap-3">
                        {importFilter === 'pending' && (
                          <input type="checkbox"
                            checked={clubCoaches.every(c => selectedImports.has(c.id))}
                            onChange={() => toggleAllImports(clubCoaches)}
                            className="w-4 h-4 rounded" />
                        )}
                        <div>
                          <span className="font-semibold text-sm" style={{ color: 'var(--fg-text)' }}>{clubName}</span>
                          <span className="font-mono text-[10px] ml-2" style={{ color: 'var(--fg-muted)' }}>{clubCoaches.length} coach{clubCoaches.length !== 1 ? 'es' : ''}</span>
                        </div>
                      </div>
                      {importFilter === 'pending' && (
                        <div className="flex gap-2">
                          <button onClick={() => {
                            const ids = clubCoaches.map(c => c.id)
                            setSelectedImports(prev => { const n = new Set(prev); ids.forEach(id => n.add(id)); return n })
                            handleBulkImport('approved')
                          }} className="font-mono text-[10px] font-bold px-3 py-1 rounded-lg" style={{ color: 'var(--fg-green)', background: 'rgba(26,110,56,.1)' }}>
                            Approve All
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Coach rows */}
                    <div className="divide-y" style={{ borderColor: 'var(--fg-border)' }}>
                      {clubCoaches.map(c => (
                        <div key={c.id} className="flex items-center gap-3 px-4 sm:px-5 py-3" data-testid={`import-coach-${c.id}`}>
                          {importFilter === 'pending' && (
                            <input type="checkbox"
                              checked={selectedImports.has(c.id)}
                              onChange={() => toggleImportSelect(c.id)}
                              className="w-4 h-4 rounded flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm" style={{ color: 'var(--fg-text)' }}>
                              {c.first_name} {c.last_name}
                            </div>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {c.license && (
                                <span className="font-mono text-[10px] px-2 py-0.5 rounded border"
                                  style={{ borderColor: 'var(--fg-border)', color: 'var(--fg-text2)' }}>
                                  {c.license}
                                </span>
                              )}
                              {c.email && (
                                <span className="font-mono text-[10px] px-2 py-0.5 rounded border"
                                  style={{ borderColor: 'var(--fg-border)', color: 'var(--fg-text2)' }}>
                                  {c.email}
                                </span>
                              )}
                              {c.city && (
                                <span className="font-mono text-[10px] px-2 py-0.5 rounded border"
                                  style={{ borderColor: 'var(--fg-border)', color: 'var(--fg-muted)' }}>
                                  {c.city}, {c.state}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            {importFilter !== 'approved' && (
                              <ActionBtn label="Approve" color="green" loading={actionLoading === c.id} onClick={() => handleImportAction(c.id, 'approved')} />
                            )}
                            {importFilter !== 'rejected' && (
                              <ActionBtn label="Reject" color="amber" loading={actionLoading === c.id} onClick={() => handleImportAction(c.id, 'rejected')} />
                            )}
                            <ActionBtn label="Delete" color="red" loading={actionLoading === c.id} onClick={() => handleImportAction(c.id, 'delete')} />
                          </div>
                        </div>
                      ))}
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
