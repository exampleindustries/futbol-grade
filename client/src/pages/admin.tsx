import { useState, useEffect, useCallback } from 'react'
import { Nav } from '@/components/layout/Nav'
import { useAuth } from '@/hooks/use-auth'
import { RatingBadge } from '@/components/ui/RatingBadge'
import { apiRequest } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase'
import { timeAgo, fullName } from '@/lib/fg-utils'
import type { Review, Listing, CoachClaim, Coach, FGEvent } from '@/lib/types'

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

type Tab = 'reviews' | 'listings' | 'claims' | 'imports' | 'users' | 'clubs' | 'events' | 'coaches' | 'audit'

interface AdminClub {
  id: string
  name: string
  abbr: string | null
  city: string
  state: string
  logo_url: string | null
  website: string | null
  contact_email: string | null
  status: string
  coach_count: number
  avg_overall: number
  coaches: { id: string; first_name: string; last_name: string; status: string }[]
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
  events: { pending: number }
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
  const [clubEdits, setClubEdits] = useState<Record<string, any>>({})
  const [editingListing, setEditingListing] = useState<string | null>(null)
  const [listingEdits, setListingEdits] = useState<Record<string, any>>({})
  const [selectedCoaches, setSelectedCoaches] = useState<Set<string>>(new Set())
  const [selectedClubs, setSelectedClubs] = useState<Set<string>>(new Set())
  const [selectedListings, setSelectedListings] = useState<Set<string>>(new Set())
  const [auditLog, setAuditLog] = useState<any[]>([])
  const [auditFilter, setAuditFilter] = useState<string>('')
  const [clubFilter, setClubFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [allCoaches, setAllCoaches] = useState<(Coach & { club?: { id: string; name: string; city: string } | null })[]>([])
  const [coachSearch, setCoachSearch] = useState('')
  const [editingCoach, setEditingCoach] = useState<string | null>(null)
  const [coachEdits, setCoachEdits] = useState<Record<string, any>>({})
  const [adminEvents, setAdminEvents] = useState<(FGEvent & { club?: { id: string; name: string } | null })[]>([])
  const [eventFilter, setEventFilter] = useState<'pending' | 'approved' | 'rejected'>('pending')
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

  const fetchEvents = useCallback(async (status: string) => {
    setLoading(true)
    try {
      const auth = await getAuthHeader()
      const res = await fetch(`${getApiBase()}/api/admin/events?status=${status}`, { headers: { Authorization: auth } })
      if (res.ok) setAdminEvents(await res.json())
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  const fetchAuditLog = useCallback(async (entityType?: string) => {
    setLoading(true)
    try {
      const auth = await getAuthHeader()
      const q = entityType ? `?entity_type=${entityType}` : ''
      const res = await fetch(`${getApiBase()}/api/admin/audit-log${q}`, { headers: { Authorization: auth } })
      if (res.ok) setAuditLog(await res.json())
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  const fetchAllCoaches = useCallback(async () => {
    setLoading(true)
    try {
      const auth = await getAuthHeader()
      const res = await fetch(`${getApiBase()}/api/admin/coaches?status=all`, { headers: { Authorization: auth } })
      if (res.ok) setAllCoaches(await res.json())
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
  useEffect(() => { if (profile?.is_admin && tab === 'events') fetchEvents(eventFilter) }, [profile, tab, eventFilter, fetchEvents])
  useEffect(() => { if (profile?.is_admin && tab === 'coaches') fetchAllCoaches() }, [profile, tab, fetchAllCoaches])
  useEffect(() => { if (profile?.is_admin && tab === 'audit') fetchAuditLog(auditFilter || undefined) }, [profile, tab, auditFilter, fetchAuditLog])

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

  async function handleListingSave(id: string) {
    const edits = listingEdits
    if (!Object.keys(edits).length) { setEditingListing(null); return }
    setActionLoading(id)
    try {
      const auth = await getAuthHeader()
      await fetch(`${getApiBase()}/api/admin/listings/${id}`, {
        method: 'PATCH',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify(edits),
      })
      setEditingListing(null)
      setListingEdits({})
      await fetchListings(listingFilter)
      await fetchStats()
    } catch { /* ignore */ }
    setActionLoading(null)
  }

  async function handleCoachSave(id: string) {
    const edits = coachEdits
    if (!Object.keys(edits).length) { setEditingCoach(null); return }
    setActionLoading(id)
    try {
      const auth = await getAuthHeader()
      await fetch(`${getApiBase()}/api/admin/coaches/${id}`, {
        method: 'PATCH',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify(edits),
      })
      setEditingCoach(null)
      setCoachEdits({})
      await fetchAllCoaches()
    } catch { /* ignore */ }
    setActionLoading(null)
  }

  async function handleBulkCoaches(status: string) {
    if (!selectedCoaches.size) return
    setActionLoading('bulk-coaches')
    try {
      const auth = await getAuthHeader()
      await fetch(`${getApiBase()}/api/admin/coaches/bulk`, {
        method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedCoaches), status }),
      })
      setSelectedCoaches(new Set())
      await fetchAllCoaches()
      await fetchStats()
    } catch { /* ignore */ }
    setActionLoading(null)
  }

  async function handleBulkClubs(status: string) {
    if (!selectedClubs.size) return
    setActionLoading('bulk-clubs')
    try {
      const auth = await getAuthHeader()
      await fetch(`${getApiBase()}/api/admin/clubs/bulk`, {
        method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedClubs), status }),
      })
      setSelectedClubs(new Set())
      await fetchClubs()
      await fetchStats()
    } catch { /* ignore */ }
    setActionLoading(null)
  }

  async function handleBulkListings(status: string) {
    if (!selectedListings.size) return
    setActionLoading('bulk-listings')
    try {
      const auth = await getAuthHeader()
      await fetch(`${getApiBase()}/api/admin/listings/bulk`, {
        method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedListings), status }),
      })
      setSelectedListings(new Set())
      await fetchListings(listingFilter)
      await fetchStats()
    } catch { /* ignore */ }
    setActionLoading(null)
  }

  function toggleSelection(set: Set<string>, setFn: (s: Set<string>) => void, id: string) {
    const next = new Set(set)
    if (next.has(id)) next.delete(id); else next.add(id)
    setFn(next)
  }

  function toggleAllSelection(set: Set<string>, setFn: (s: Set<string>) => void, ids: string[]) {
    const allSelected = ids.every(id => set.has(id))
    const next = new Set(set)
    ids.forEach(id => allSelected ? next.delete(id) : next.add(id))
    setFn(next)
  }

  function startCoachEdit(c: any) {
    setEditingCoach(c.id)
    setCoachEdits({
      first_name: c.first_name,
      last_name: c.last_name,
      city: c.city || '',
      state: c.state || '',
      gender: c.gender || 'coed',
      age_groups: c.age_groups || [],
      club_id: c.club_id || '',
      license: c.license || '',
      email: c.email || '',
      status: c.status || 'pending',
      specialization: c.specialization || '',
    })
  }

  async function handleEventAction(id: string, action: 'approved' | 'rejected' | 'delete') {
    setActionLoading(id)
    try {
      const auth = await getAuthHeader()
      if (action === 'delete') {
        await fetch(`${getApiBase()}/api/admin/events/${id}`, { method: 'DELETE', headers: { Authorization: auth } })
      } else {
        await fetch(`${getApiBase()}/api/admin/events/${id}`, {
          method: 'PATCH', headers: { Authorization: auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: action }),
        })
      }
      await fetchEvents(eventFilter)
      await fetchStats()
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
          {(['reviews', 'listings', 'claims', 'imports', 'events', 'coaches', 'users', 'clubs', 'audit'] as Tab[]).map(t => {
            const count = stats ? (t === 'reviews' ? stats.reviews.pending : t === 'listings' ? stats.listings.pending : t === 'claims' ? stats.claims.pending : t === 'imports' ? stats.imports.pending : t === 'events' ? stats.events.pending : t === 'coaches' ? allCoaches.length : t === 'users' ? users.length : t === 'clubs' ? adminClubs.length : t === 'audit' ? auditLog.length : 0) : 0
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
            <BulkToolbar count={selectedListings.size} loading={actionLoading === 'bulk-listings'} actions={[
              { label: 'Approve', color: 'green', onClick: () => handleBulkListings('active') },
              { label: 'Remove', color: 'amber', onClick: () => handleBulkListings('removed') },
              { label: 'Delete', color: 'red', onClick: () => handleBulkListings('delete') },
            ]} />
            {loading ? <Skeleton /> : listings.length === 0 ? (
              <EmptyState text={`No ${listingFilter} listings`} />
            ) : (
              <div className="space-y-3">
                {listings.length > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded"
                      checked={listings.length > 0 && listings.every(l => selectedListings.has(l.id))}
                      onChange={() => toggleAllSelection(selectedListings, setSelectedListings, listings.map(l => l.id))} />
                    <span className="font-mono text-[10px] font-bold" style={{ color: 'var(--fg-muted)' }}>Select all</span>
                  </label>
                )}
                {listings.map(l => (
                  <div key={l.id} className="bg-white border rounded-xl overflow-hidden" style={{ borderColor: selectedListings.has(l.id) ? 'var(--fg-green)' : 'var(--fg-border)' }} data-testid={`admin-listing-${l.id}`}>
                    {editingListing === l.id ? (
                      /* ── Edit mode ── */
                      <div className="p-4 space-y-3">
                        <div>
                          <label className="block font-mono text-[9px] font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--fg-muted)' }}>Title</label>
                          <input value={listingEdits.title || ''} onChange={e => setListingEdits(p => ({ ...p, title: e.target.value }))}
                            className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-text)' }} />
                        </div>
                        <div>
                          <label className="block font-mono text-[9px] font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--fg-muted)' }}>Description</label>
                          <textarea value={listingEdits.description || ''} onChange={e => setListingEdits(p => ({ ...p, description: e.target.value }))} rows={2}
                            className="w-full border rounded-lg px-3 py-2 text-sm outline-none resize-none" style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-text)' }} />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block font-mono text-[9px] font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--fg-muted)' }}>Category</label>
                            <select value={listingEdits.type || 'other'} onChange={e => setListingEdits(p => ({ ...p, type: e.target.value }))}
                              className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-text)' }}>
                              <option value="cleats">Cleats</option>
                              <option value="jersey">Jersey</option>
                              <option value="equipment">Equipment</option>
                              <option value="training">Training</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                          <div>
                            <label className="block font-mono text-[9px] font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--fg-muted)' }}>Price ($)</label>
                            <input type="number" value={listingEdits.price_cents ? (listingEdits.price_cents / 100) : ''}
                              onChange={e => setListingEdits(p => ({ ...p, price_cents: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null }))}
                              placeholder="0" className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-text)' }} />
                          </div>
                          <div>
                            <label className="block font-mono text-[9px] font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--fg-muted)' }}>Status</label>
                            <select value={listingEdits.status || 'pending'} onChange={e => setListingEdits(p => ({ ...p, status: e.target.value }))}
                              className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-text)' }}>
                              <option value="active">Active</option>
                              <option value="pending">Pending</option>
                              <option value="removed">Removed</option>
                              <option value="sold">Sold</option>
                              <option value="expired">Expired</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={listingEdits.featured || false}
                              onChange={e => setListingEdits(p => ({ ...p, featured: e.target.checked }))}
                              className="w-4 h-4 rounded" />
                            <span className="font-mono text-[10px] font-bold" style={{ color: 'var(--fg-muted)' }}>Featured</span>
                          </label>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <ActionBtn label="Save" color="green" loading={actionLoading === l.id} onClick={() => handleListingSave(l.id)} />
                          <button onClick={() => { setEditingListing(null); setListingEdits({}) }}
                            className="font-mono text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all"
                            style={{ background: 'var(--fg-surface)', color: 'var(--fg-muted)', borderColor: 'var(--fg-border2)' }}>Cancel</button>
                          <div className="ml-auto flex gap-2">
                            <ActionBtn label="Delete" color="red" loading={actionLoading === l.id} onClick={() => handleListingAction(l.id, 'delete')} />
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* ── View mode ── */
                      <div className="flex items-center gap-4 p-4 sm:p-5">
                        <input type="checkbox" className="w-4 h-4 rounded flex-shrink-0"
                          checked={selectedListings.has(l.id)}
                          onChange={() => toggleSelection(selectedListings, setSelectedListings, l.id)} />
                        {l.image_urls?.[0] && (
                          <img src={l.image_urls[0]} alt={l.title} className="w-14 h-14 rounded-xl object-cover border flex-shrink-0" style={{ borderColor: 'var(--fg-border)' }} />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm truncate" style={{ color: 'var(--fg-text)' }}>{l.title}</span>
                            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded capitalize"
                              style={{ background: l.status === 'active' ? 'var(--fg-green-pale)' : l.status === 'removed' ? 'var(--fg-red-pale)' : 'var(--fg-surface)', color: l.status === 'active' ? 'var(--fg-green)' : l.status === 'removed' ? 'var(--fg-red)' : 'var(--fg-muted)' }}>
                              {l.status}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded border capitalize" style={{ borderColor: 'var(--fg-border)', color: 'var(--fg-green)' }}>{l.type}</span>
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded border" style={{ borderColor: 'var(--fg-border)', color: 'var(--fg-text2)' }}>
                              {l.price_cents ? `$${(l.price_cents / 100).toFixed(0)}` : l.price_text || 'Free'}
                            </span>
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded border" style={{ borderColor: 'var(--fg-border)', color: 'var(--fg-muted)' }}>
                              {l.seller?.alias_emoji || '⚽'} {l.seller?.alias || 'Seller'}
                            </span>
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded border" style={{ borderColor: 'var(--fg-border)', color: 'var(--fg-muted)' }}>{timeAgo(l.created_at)}</span>
                            {l.featured && <span className="font-mono text-[10px] px-2 py-0.5 rounded border" style={{ borderColor: '#f59e0b', color: '#f59e0b' }}>★ Featured</span>}
                          </div>
                        </div>
                        <button onClick={() => {
                          setEditingListing(l.id)
                          setListingEdits({
                            title: l.title,
                            description: l.description || '',
                            type: l.type,
                            price_cents: l.price_cents,
                            status: l.status,
                            featured: l.featured,
                          })
                        }}
                          className="font-mono text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all flex-shrink-0"
                          style={{ background: 'var(--fg-surface)', color: 'var(--fg-green)', borderColor: 'var(--fg-green)' }}>Edit</button>
                      </div>
                    )}
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
            <BulkToolbar count={selectedClubs.size} loading={actionLoading === 'bulk-clubs'} actions={[
              { label: 'Approve', color: 'green', onClick: () => handleBulkClubs('approved') },
              { label: 'Reject', color: 'amber', onClick: () => handleBulkClubs('rejected') },
            ]} />
            {loading ? <Skeleton /> : (() => {
              const pending = adminClubs.filter(c => c.status === 'pending')
              const approved = adminClubs.filter(c => c.status === 'approved')
              return (
              <div className="space-y-8">
                {/* Pending section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bebas text-xl tracking-[2px]" style={{ color: 'var(--fg-text)' }}>PENDING APPROVAL</span>
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#f59e0b', color: 'white' }}>{pending.length}</span>
                    </div>
                    {pending.length > 0 && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 rounded"
                          checked={pending.length > 0 && pending.every(c => selectedClubs.has(c.id))}
                          onChange={() => toggleAllSelection(selectedClubs, setSelectedClubs, pending.map(c => c.id))} />
                        <span className="font-mono text-[10px] font-bold" style={{ color: 'var(--fg-muted)' }}>Select all ({pending.length})</span>
                      </label>
                    )}
                  </div>
                  {pending.length === 0 ? (
                    <div className="bg-white border rounded-xl p-6 text-center" style={{ borderColor: 'var(--fg-border)' }}>
                      <span className="text-sm" style={{ color: 'var(--fg-muted)' }}>No pending clubs</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {pending.map(c => (
                  <div key={c.id} className="bg-white border rounded-xl overflow-hidden" style={{ borderColor: selectedClubs.has(c.id) ? 'var(--fg-green)' : 'var(--fg-border)' }} data-testid={`admin-club-${c.id}`}>
                    {editingClub === c.id ? (
                      /* ── Edit mode ── */
                      <div className="p-4 space-y-3">
                        {/* Drag-and-drop logo upload */}
                        <div
                          className="relative rounded-xl border-2 border-dashed p-4 text-center transition-all cursor-pointer"
                          style={{ borderColor: uploadingLogo === c.id ? 'var(--fg-green)' : 'var(--fg-border2)', background: 'var(--fg-surface)' }}
                          onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--fg-green)'; e.currentTarget.style.background = 'var(--fg-green-pale)' }}
                          onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--fg-border2)'; e.currentTarget.style.background = 'var(--fg-surface)' }}
                          onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--fg-border2)'; e.currentTarget.style.background = 'var(--fg-surface)'; const f = e.dataTransfer.files[0]; if (f && f.type.startsWith('image/')) handleLogoUpload(c.id, c.name, f) }}
                          onClick={() => document.getElementById(`logo-input-${c.id}`)?.click()}
                        >
                          <input id={`logo-input-${c.id}`} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(c.id, c.name, f); e.target.value = '' }} />
                          {c.logo_url ? (
                            <div className="flex items-center justify-center gap-4">
                              <img src={c.logo_url} alt={c.name} className="w-16 h-16 rounded-xl object-contain border" style={{ borderColor: 'var(--fg-border)' }} />
                              <div>
                                <span className="font-mono text-[10px] font-bold block" style={{ color: uploadingLogo === c.id ? 'var(--fg-muted)' : 'var(--fg-green)' }}>
                                  {uploadingLogo === c.id ? 'Uploading...' : 'Drop new logo here or click to replace'}
                                </span>
                                <span className="font-mono text-[9px]" style={{ color: 'var(--fg-muted)' }}>PNG, JPG, or WebP</span>
                              </div>
                            </div>
                          ) : (
                            <div className="py-3">
                              <div className="text-2xl mb-1">🖼️</div>
                              <span className="font-mono text-[10px] font-bold block" style={{ color: uploadingLogo === c.id ? 'var(--fg-muted)' : 'var(--fg-green)' }}>
                                {uploadingLogo === c.id ? 'Uploading...' : 'Drag & drop logo here'}
                              </span>
                              <span className="font-mono text-[9px]" style={{ color: 'var(--fg-muted)' }}>or click to browse · PNG, JPG, WebP</span>
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block font-mono text-[9px] font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--fg-muted)' }}>Club Name</label>
                            <input value={clubEdits.name || ''} onChange={e => setClubEdits(p => ({ ...p, name: e.target.value }))}
                              className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-text)' }} />
                          </div>
                          <div>
                            <label className="block font-mono text-[9px] font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--fg-muted)' }}>Division / Abbr</label>
                            <input value={clubEdits.abbr || ''} onChange={e => setClubEdits(p => ({ ...p, abbr: e.target.value }))}
                              placeholder="e.g. ECNL, CalSouth" className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-text)' }} />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block font-mono text-[9px] font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--fg-muted)' }}>City</label>
                            <input value={clubEdits.city || ''} onChange={e => setClubEdits(p => ({ ...p, city: e.target.value }))}
                              className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-text)' }} />
                          </div>
                          <div>
                            <label className="block font-mono text-[9px] font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--fg-muted)' }}>State</label>
                            <input value={clubEdits.state || ''} onChange={e => setClubEdits(p => ({ ...p, state: e.target.value }))}
                              className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-text)' }} />
                          </div>
                          <div>
                            <label className="block font-mono text-[9px] font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--fg-muted)' }}>Status</label>
                            <select value={clubEdits.status || 'approved'} onChange={e => setClubEdits(p => ({ ...p, status: e.target.value }))}
                              className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-text)' }}>
                              <option value="approved">Approved</option>
                              <option value="pending">Pending</option>
                              <option value="rejected">Rejected</option>
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block font-mono text-[9px] font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--fg-muted)' }}>Contact Email</label>
                            <input type="email" value={clubEdits.contact_email || ''} onChange={e => setClubEdits(p => ({ ...p, contact_email: e.target.value }))}
                              placeholder="club@example.com" className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-text)' }} />
                          </div>
                          <div>
                            <label className="block font-mono text-[9px] font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--fg-muted)' }}>Website</label>
                            <input value={clubEdits.website || ''} onChange={e => setClubEdits(p => ({ ...p, website: e.target.value }))}
                              placeholder="https://..." className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-text)' }} />
                          </div>
                        </div>
                        {/* Associated coaches */}
                        <div>
                          <label className="block font-mono text-[9px] font-bold tracking-widest uppercase mb-1.5" style={{ color: 'var(--fg-muted)' }}>Associated Coaches ({c.coaches.length})</label>
                          {c.coaches.length === 0 ? (
                            <span className="font-mono text-[10px]" style={{ color: 'var(--fg-muted)' }}>No coaches assigned</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {c.coaches.map(coach => (
                                <a key={coach.id} href={`/coaches/${coach.id}`} target="_blank" rel="noopener noreferrer"
                                  className="font-mono text-[10px] px-2.5 py-1 rounded-lg border hover:shadow-sm transition-all inline-flex items-center gap-1"
                                  style={{ borderColor: 'var(--fg-border)', color: coach.status === 'approved' ? 'var(--fg-text2)' : 'var(--fg-muted)' }}>
                                  {coach.first_name} {coach.last_name}
                                  {coach.status !== 'approved' && <span className="text-[8px] uppercase opacity-60">({coach.status})</span>}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button onClick={async () => {
                            setActionLoading(c.id)
                            const auth = await getAuthHeader()
                            await fetch(`${getApiBase()}/api/admin/clubs/${c.id}`, {
                              method: 'PATCH', headers: { Authorization: auth, 'Content-Type': 'application/json' },
                              body: JSON.stringify(clubEdits),
                            })
                            setEditingClub(null); setClubEdits({})
                            await fetchClubs()
                            setActionLoading(null)
                          }} className="font-mono text-[10px] font-bold px-3 py-1.5 rounded-lg text-white" style={{ background: 'var(--fg-green)' }}>
                            {actionLoading === c.id ? '...' : 'Save'}
                          </button>
                          <button onClick={() => { setEditingClub(null); setClubEdits({}) }}
                            className="font-mono text-[10px] font-bold px-3 py-1.5 rounded-lg border" style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-text2)' }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      /* ── View mode ── */
                      <div className="flex items-center gap-4 p-4 sm:p-5">
                        <input type="checkbox" className="w-4 h-4 rounded flex-shrink-0"
                          checked={selectedClubs.has(c.id)}
                          onChange={() => toggleSelection(selectedClubs, setSelectedClubs, c.id)} />
                        <div className="flex-shrink-0">
                          {c.logo_url ? (
                            <img src={c.logo_url} alt={c.name} className="w-14 h-14 rounded-xl object-contain border" style={{ borderColor: 'var(--fg-border)' }} />
                          ) : (
                            <div className="w-14 h-14 rounded-xl flex items-center justify-center border-2 border-dashed" style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-muted)' }}>
                              <span className="text-[10px] font-mono">No logo</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm" style={{ color: 'var(--fg-text)' }}>{c.name}</span>
                            {c.abbr && <span className="font-mono text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'var(--fg-surface)', color: 'var(--fg-muted)' }}>{c.abbr}</span>}
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded border" style={{ borderColor: 'var(--fg-border)', color: 'var(--fg-text2)' }}>{c.city}, {c.state}</span>
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded border" style={{ borderColor: 'var(--fg-border)', color: 'var(--fg-muted)' }}>{c.coaches.length} coaches</span>
                            {c.avg_overall > 0 && <span className="font-mono text-[10px] px-2 py-0.5 rounded border" style={{ borderColor: 'var(--fg-border)', color: 'var(--fg-green)' }}>★ {c.avg_overall.toFixed(1)}</span>}
                            {c.contact_email && <span className="font-mono text-[10px] px-2 py-0.5 rounded border" style={{ borderColor: 'var(--fg-border)', color: 'var(--fg-muted)' }}>{c.contact_email}</span>}
                            {c.website && <span className="font-mono text-[10px] px-2 py-0.5 rounded border" style={{ borderColor: 'var(--fg-border)', color: 'var(--fg-muted)' }}>🌐</span>}
                          </div>
                        </div>
                        <button onClick={() => {
                          setEditingClub(c.id)
                          setClubEdits({ name: c.name, abbr: c.abbr || '', city: c.city, state: c.state, status: c.status, contact_email: c.contact_email || '', website: c.website || '' })
                        }}
                          className="font-mono text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all flex-shrink-0"
                          style={{ background: 'var(--fg-surface)', color: 'var(--fg-green)', borderColor: 'var(--fg-green)' }}>Edit</button>
                      </div>
                    )}
                  </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Approved section */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="font-bebas text-xl tracking-[2px]" style={{ color: 'var(--fg-text)' }}>APPROVED</span>
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--fg-green)', color: 'white' }}>{approved.length}</span>
                  </div>
                  {approved.length === 0 ? (
                    <div className="bg-white border rounded-xl p-6 text-center" style={{ borderColor: 'var(--fg-border)' }}>
                      <span className="text-sm" style={{ color: 'var(--fg-muted)' }}>No approved clubs</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {approved.map(c => (
                  <div key={c.id} className="bg-white border rounded-xl overflow-hidden" style={{ borderColor: selectedClubs.has(c.id) ? 'var(--fg-green)' : 'var(--fg-border)' }} data-testid={`admin-club-approved-${c.id}`}>
                    {editingClub === c.id ? (
                      <div className="p-4 space-y-3">
                        <span className="font-mono text-[10px] font-bold" style={{ color: 'var(--fg-green)' }}>Editing — use the pending section above for full edit form</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4 p-4 sm:p-5">
                        <input type="checkbox" className="w-4 h-4 rounded flex-shrink-0"
                          checked={selectedClubs.has(c.id)}
                          onChange={() => toggleSelection(selectedClubs, setSelectedClubs, c.id)} />
                        <div className="flex-shrink-0">
                          {c.logo_url ? (
                            <img src={c.logo_url} alt={c.name} className="w-14 h-14 rounded-xl object-contain border" style={{ borderColor: 'var(--fg-border)' }} />
                          ) : (
                            <div className="w-14 h-14 rounded-xl flex items-center justify-center border-2 border-dashed" style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-muted)' }}>
                              <span className="text-[10px] font-mono">No logo</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm" style={{ color: 'var(--fg-text)' }}>{c.name}</span>
                            {c.abbr && <span className="font-mono text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'var(--fg-surface)', color: 'var(--fg-muted)' }}>{c.abbr}</span>}
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded border" style={{ borderColor: 'var(--fg-border)', color: 'var(--fg-text2)' }}>{c.city}, {c.state}</span>
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded border" style={{ borderColor: 'var(--fg-border)', color: 'var(--fg-muted)' }}>{c.coaches.length} coaches</span>
                            {c.avg_overall > 0 && <span className="font-mono text-[10px] px-2 py-0.5 rounded border" style={{ borderColor: 'var(--fg-border)', color: 'var(--fg-green)' }}>★ {c.avg_overall.toFixed(1)}</span>}
                          </div>
                        </div>
                        <button onClick={() => {
                          setEditingClub(c.id)
                          setClubEdits({ name: c.name, abbr: c.abbr || '', city: c.city, state: c.state, status: c.status, contact_email: c.contact_email || '', website: c.website || '' })
                        }}
                          className="font-mono text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all flex-shrink-0"
                          style={{ background: 'var(--fg-surface)', color: 'var(--fg-green)', borderColor: 'var(--fg-green)' }}>Edit</button>
                      </div>
                    )}
                  </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              )
            })()}
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

        {/* Events tab */}
        {tab === 'events' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <FilterBar<'pending' | 'approved' | 'rejected'>
                options={[
                  { value: 'pending', label: 'Pending' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'rejected', label: 'Rejected' },
                ]}
                value={eventFilter}
                onChange={setEventFilter}
              />
              <button
                onClick={async () => {
                  setActionLoading('crawl')
                  try {
                    const auth = await getAuthHeader()
                    const res = await fetch(`${getApiBase()}/api/admin/events/crawl`, {
                      method: 'POST', headers: { Authorization: auth },
                    })
                    const data = await res.json()
                    alert(data.message || 'Scan complete')
                    await fetchEvents(eventFilter)
                    await fetchStats()
                  } catch { alert('Scan failed') }
                  setActionLoading(null)
                }}
                disabled={actionLoading === 'crawl'}
                className="font-mono text-[11px] font-semibold px-4 py-2 rounded-lg border transition-all whitespace-nowrap"
                style={{ background: 'var(--fg-surface)', color: 'var(--fg-green)', borderColor: 'var(--fg-green)' }}
                data-testid="crawl-events">
                {actionLoading === 'crawl' ? 'Scanning...' : '🔍 Scan Club Websites'}
              </button>
            </div>
            {loading ? <Skeleton /> : adminEvents.length === 0 ? (
              <EmptyState text={`No ${eventFilter} event flyers`} />
            ) : (
              <div className="space-y-3">
                {adminEvents.map(ev => (
                  <div key={ev.id} className="bg-white border rounded-xl overflow-hidden" style={{ borderColor: 'var(--fg-border)' }} data-testid={`admin-event-${ev.id}`}>
                    <div className="flex gap-4 p-4 sm:p-5">
                      {ev.flyer_url && (
                        <a href={ev.flyer_url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                          <img src={ev.flyer_url} alt={ev.title} className="w-24 h-24 object-cover rounded-lg border" style={{ borderColor: 'var(--fg-border)' }} />
                        </a>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm" style={{ color: 'var(--fg-text)' }}>{ev.title}</div>
                        <div className="flex flex-wrap gap-2 mt-1.5">
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded border" style={{ borderColor: 'var(--fg-border)', color: 'var(--fg-green)' }}>
                            📅 {new Date(ev.event_date + 'T00:00:00').toLocaleDateString()}
                            {ev.end_date && ev.end_date !== ev.event_date && ` – ${new Date(ev.end_date + 'T00:00:00').toLocaleDateString()}`}
                          </span>
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded border capitalize" style={{ borderColor: 'var(--fg-border)', color: 'var(--fg-muted)' }}>
                            {ev.source.replace('_', ' ')}
                          </span>
                          {ev.club && (
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded border" style={{ borderColor: 'var(--fg-border)', color: 'var(--fg-muted)' }}>
                              {ev.club.name}
                            </span>
                          )}
                        </div>
                        {ev.description && (
                          <p className="text-xs mt-2 line-clamp-2" style={{ color: 'var(--fg-muted)' }}>{ev.description}</p>
                        )}
                        <div className="font-mono text-[10px] mt-2" style={{ color: 'var(--fg-muted)' }}>
                          Submitted {timeAgo(ev.created_at)}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        {eventFilter !== 'approved' && (
                          <ActionBtn label="Approve" color="green" loading={actionLoading === ev.id} onClick={() => handleEventAction(ev.id, 'approved')} />
                        )}
                        {eventFilter !== 'rejected' && (
                          <ActionBtn label="Reject" color="amber" loading={actionLoading === ev.id} onClick={() => handleEventAction(ev.id, 'rejected')} />
                        )}
                        <ActionBtn label="Delete" color="red" loading={actionLoading === ev.id} onClick={() => handleEventAction(ev.id, 'delete')} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Coaches tab */}
        {tab === 'coaches' && (
          <>
            <div className="flex gap-3 mb-4">
              <input type="search" value={coachSearch} onChange={e => setCoachSearch(e.target.value)}
                placeholder="Search coaches..." className="flex-1 px-4 py-2 rounded-lg text-sm border outline-none"
                style={{ borderColor: 'var(--fg-border2)', background: 'var(--fg-surface)', color: 'var(--fg-text)' }}
                data-testid="coach-admin-search" />
            </div>
            <BulkToolbar count={selectedCoaches.size} loading={actionLoading === 'bulk-coaches'} actions={[
              { label: 'Approve', color: 'green', onClick: () => handleBulkCoaches('approved') },
              { label: 'Reject', color: 'amber', onClick: () => handleBulkCoaches('rejected') },
              { label: 'Delete', color: 'red', onClick: () => handleBulkCoaches('delete') },
            ]} />
            {loading ? <Skeleton /> : (() => {
              const filtered = allCoaches.filter(c => {
                if (!coachSearch.trim()) return true
                const q = coachSearch.toLowerCase()
                return c.first_name.toLowerCase().includes(q) || c.last_name.toLowerCase().includes(q) || (c.club?.name || '').toLowerCase().includes(q)
              })
              return filtered.length === 0 ? (
                <EmptyState text="No coaches found" />
              ) : (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded"
                      checked={filtered.length > 0 && filtered.every(c => selectedCoaches.has(c.id))}
                      onChange={() => toggleAllSelection(selectedCoaches, setSelectedCoaches, filtered.map(c => c.id))} />
                    <span className="font-mono text-[10px] font-bold" style={{ color: 'var(--fg-muted)' }}>Select all ({filtered.length})</span>
                  </label>
                  {filtered.map(c => (
                    <div key={c.id} className="bg-white border rounded-xl overflow-hidden" style={{ borderColor: selectedCoaches.has(c.id) ? 'var(--fg-green)' : 'var(--fg-border)' }} data-testid={`admin-coach-${c.id}`}>
                      {editingCoach === c.id ? (
                        /* ── Edit mode ── */
                        <div className="p-4 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block font-mono text-[9px] font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--fg-muted)' }}>First Name</label>
                              <input value={coachEdits.first_name || ''} onChange={e => setCoachEdits(p => ({ ...p, first_name: e.target.value }))}
                                className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-text)' }} />
                            </div>
                            <div>
                              <label className="block font-mono text-[9px] font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--fg-muted)' }}>Last Name</label>
                              <input value={coachEdits.last_name || ''} onChange={e => setCoachEdits(p => ({ ...p, last_name: e.target.value }))}
                                className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-text)' }} />
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="block font-mono text-[9px] font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--fg-muted)' }}>City</label>
                              <input value={coachEdits.city || ''} onChange={e => setCoachEdits(p => ({ ...p, city: e.target.value }))}
                                className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-text)' }} />
                            </div>
                            <div>
                              <label className="block font-mono text-[9px] font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--fg-muted)' }}>State</label>
                              <input value={coachEdits.state || ''} onChange={e => setCoachEdits(p => ({ ...p, state: e.target.value }))}
                                className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-text)' }} />
                            </div>
                            <div>
                              <label className="block font-mono text-[9px] font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--fg-muted)' }}>Status</label>
                              <select value={coachEdits.status || 'pending'} onChange={e => setCoachEdits(p => ({ ...p, status: e.target.value }))}
                                className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-text)' }}>
                                <option value="approved">Approved</option>
                                <option value="pending">Pending</option>
                                <option value="rejected">Rejected</option>
                              </select>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block font-mono text-[9px] font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--fg-muted)' }}>Club Assignment</label>
                              <select value={coachEdits.club_id || ''} onChange={e => setCoachEdits(p => ({ ...p, club_id: e.target.value || null }))}
                                className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-text)' }}>
                                <option value="">No club</option>
                                {adminClubs.map(cl => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block font-mono text-[9px] font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--fg-muted)' }}>Gender</label>
                              <select value={coachEdits.gender || 'coed'} onChange={e => setCoachEdits(p => ({ ...p, gender: e.target.value }))}
                                className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-text)' }}>
                                <option value="coed">Coed</option>
                                <option value="boys">Boys</option>
                                <option value="girls">Girls</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="block font-mono text-[9px] font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--fg-muted)' }}>Age Groups</label>
                            <div className="flex flex-wrap gap-1.5">
                              {['U6','U8','U10','U12','U14','U16','U18','U19+'].map(ag => {
                                const selected = (coachEdits.age_groups || []).includes(ag)
                                return (
                                  <button key={ag} type="button" onClick={() => {
                                    setCoachEdits(p => ({
                                      ...p,
                                      age_groups: selected
                                        ? (p.age_groups || []).filter((x: string) => x !== ag)
                                        : [...(p.age_groups || []), ag]
                                    }))
                                  }}
                                    className="font-mono text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-all"
                                    style={selected
                                      ? { background: 'var(--fg-green)', color: 'white', borderColor: 'var(--fg-green)' }
                                      : { background: 'var(--fg-surface)', color: 'var(--fg-muted)', borderColor: 'var(--fg-border2)' }}>
                                    {ag}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                          <div>
                            <label className="block font-mono text-[9px] font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--fg-muted)' }}>Specialization</label>
                            <input value={coachEdits.specialization || ''} onChange={e => setCoachEdits(p => ({ ...p, specialization: e.target.value }))}
                              placeholder="e.g. Goalkeeper, Striker Development, Fitness" className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-text)' }} />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block font-mono text-[9px] font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--fg-muted)' }}>License</label>
                              <input value={coachEdits.license || ''} onChange={e => setCoachEdits(p => ({ ...p, license: e.target.value }))}
                                className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-text)' }} />
                            </div>
                            <div>
                              <label className="block font-mono text-[9px] font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--fg-muted)' }}>Email</label>
                              <input value={coachEdits.email || ''} onChange={e => setCoachEdits(p => ({ ...p, email: e.target.value }))}
                                className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-text)' }} />
                            </div>
                          </div>
                          <div className="flex gap-2 pt-1">
                            <ActionBtn label="Save" color="green" loading={actionLoading === c.id} onClick={() => handleCoachSave(c.id)} />
                            <button onClick={() => { setEditingCoach(null); setCoachEdits({}) }}
                              className="font-mono text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all"
                              style={{ background: 'var(--fg-surface)', color: 'var(--fg-muted)', borderColor: 'var(--fg-border2)' }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        /* ── View mode ── */
                        <div className="flex items-center gap-3 px-4 py-3">
                          <input type="checkbox" className="w-4 h-4 rounded flex-shrink-0"
                            checked={selectedCoaches.has(c.id)}
                            onChange={() => toggleSelection(selectedCoaches, setSelectedCoaches, c.id)} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm" style={{ color: 'var(--fg-text)' }}>{c.first_name} {c.last_name}</span>
                              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded capitalize" style={{ background: c.status === 'approved' ? 'var(--fg-green-pale)' : c.status === 'rejected' ? 'var(--fg-red-pale)' : 'var(--fg-surface)', color: c.status === 'approved' ? 'var(--fg-green)' : c.status === 'rejected' ? 'var(--fg-red)' : 'var(--fg-muted)' }}>{c.status}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {c.club && <span className="font-mono text-[10px] px-2 py-0.5 rounded border" style={{ borderColor: 'var(--fg-border)', color: 'var(--fg-text2)' }}>{c.club.name}</span>}
                              {c.city && <span className="font-mono text-[10px] px-2 py-0.5 rounded border" style={{ borderColor: 'var(--fg-border)', color: 'var(--fg-muted)' }}>{c.city}, {c.state}</span>}
                              {c.gender && c.gender !== 'coed' && <span className="font-mono text-[10px] px-2 py-0.5 rounded border capitalize" style={{ borderColor: 'var(--fg-border)', color: 'var(--fg-muted)' }}>{c.gender}</span>}
                              {(c.age_groups || []).length > 0 && <span className="font-mono text-[10px] px-2 py-0.5 rounded border" style={{ borderColor: 'var(--fg-border)', color: 'var(--fg-muted)' }}>{(c.age_groups || []).join(', ')}</span>}
                              {(c as any).specialization && <span className="font-mono text-[10px] px-2 py-0.5 rounded border" style={{ borderColor: 'var(--fg-border)', color: 'var(--fg-green)' }}>{(c as any).specialization}</span>}
                              {c.license && <span className="font-mono text-[10px] px-2 py-0.5 rounded border" style={{ borderColor: 'var(--fg-border)', color: 'var(--fg-muted)' }}>{c.license}</span>}
                            </div>
                          </div>
                          <button onClick={() => { fetchClubs(); startCoachEdit(c) }}
                            className="font-mono text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all flex-shrink-0"
                            style={{ background: 'var(--fg-surface)', color: 'var(--fg-green)', borderColor: 'var(--fg-green)' }}
                            data-testid={`edit-coach-${c.id}`}>Edit</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            })()}
          </>
        )}

        {/* Audit Log tab */}
        {tab === 'audit' && (
          <>
            <div className="flex gap-1.5 mb-4 overflow-x-auto">
              {[{ v: '', l: 'All' }, { v: 'review', l: 'Reviews' }, { v: 'listing', l: 'Listings' }, { v: 'coach', l: 'Coaches' }, { v: 'club', l: 'Clubs' }, { v: 'claim', l: 'Claims' }, { v: 'event', l: 'Events' }].map(f => (
                <button key={f.v} onClick={() => setAuditFilter(f.v)}
                  className="font-mono text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all whitespace-nowrap"
                  style={auditFilter === f.v
                    ? { background: 'var(--fg-text)', color: 'white', borderColor: 'var(--fg-text)' }
                    : { background: 'var(--fg-surface)', color: 'var(--fg-muted)', borderColor: 'var(--fg-border)' }}
                  data-testid={`audit-filter-${f.v || 'all'}`}>{f.l}</button>
              ))}
            </div>
            {loading ? <Skeleton /> : auditLog.length === 0 ? (
              <EmptyState text="No audit entries found" />
            ) : (
              <div className="space-y-2">
                <span className="font-mono text-[10px] font-bold" style={{ color: 'var(--fg-muted)' }}>{auditLog.length} entries</span>
                {auditLog.map((entry: any) => {
                  const actionColors: Record<string, { bg: string; color: string }> = {
                    'delete': { bg: 'var(--fg-red-pale)', color: 'var(--fg-red)' },
                    'bulk_delete': { bg: 'var(--fg-red-pale)', color: 'var(--fg-red)' },
                    'bulk_status_change': { bg: 'var(--fg-green-pale)', color: 'var(--fg-green)' },
                  }
                  const ac = actionColors[entry.action] || { bg: 'var(--fg-surface)', color: 'var(--fg-muted)' }
                  return (
                    <div key={entry.id} className="bg-white border rounded-xl px-4 py-3" style={{ borderColor: 'var(--fg-border)' }} data-testid={`audit-${entry.id}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded capitalize"
                              style={{ background: ac.bg, color: ac.color }}>
                              {entry.action.replace(/_/g, ' ')}
                            </span>
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded border capitalize"
                              style={{ borderColor: 'var(--fg-border)', color: 'var(--fg-text2)' }}>
                              {entry.entity_type}
                            </span>
                            <span className="font-mono text-[10px]" style={{ color: 'var(--fg-muted)' }}>
                              {entry.entity_count} item{entry.entity_count !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="font-mono text-[10px] font-semibold" style={{ color: 'var(--fg-text)' }}>
                              {entry.admin_email || 'Unknown admin'}
                            </span>
                            <span className="font-mono text-[10px]" style={{ color: 'var(--fg-muted)' }}>
                              {timeAgo(entry.created_at)}
                            </span>
                          </div>
                          {entry.details && Object.keys(entry.details).length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {Object.entries(entry.details).map(([k, v]) => (
                                <span key={k} className="font-mono text-[9px] px-2 py-0.5 rounded border"
                                  style={{ borderColor: 'var(--fg-border)', color: 'var(--fg-muted)' }}>
                                  {k}: {String(v)}
                                </span>
                              ))}
                            </div>
                          )}
                          {entry.entity_ids?.length > 0 && entry.entity_ids.length <= 5 && (
                            <div className="font-mono text-[9px] mt-1" style={{ color: 'var(--fg-muted)' }}>
                              IDs: {entry.entity_ids.map((id: string) => id.slice(0, 8)).join(', ')}
                            </div>
                          )}
                        </div>
                        <span className="font-mono text-[9px] whitespace-nowrap flex-shrink-0" style={{ color: 'var(--fg-muted)' }}>
                          {new Date(entry.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )
                })}
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
  if (!base.startsWith("__")) return base
  return import.meta.env.VITE_API_URL || ''
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

function BulkToolbar({ count, actions, loading }: { count: number; actions: { label: string; color: 'green' | 'amber' | 'red'; onClick: () => void }[]; loading: boolean }) {
  const [confirming, setConfirming] = useState<string | null>(null)
  if (count === 0) return null
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl mb-3 border"
      style={{ background: confirming ? 'var(--fg-red-pale)' : 'var(--fg-green-pale)', borderColor: confirming ? 'rgba(192,57,43,.2)' : 'rgba(26,110,56,.2)' }}>
      <input type="checkbox" checked readOnly className="w-4 h-4 rounded" />
      <span className="font-mono text-[11px] font-bold" style={{ color: 'var(--fg-text)' }}>{count} selected</span>
      <div className="flex gap-2 ml-auto">
        {confirming ? (
          <>
            <span className="font-mono text-[11px] font-semibold" style={{ color: 'var(--fg-red)' }}>Delete {count} items?</span>
            <button onClick={() => { const a = actions.find(x => x.label === confirming); a?.onClick(); setConfirming(null) }} disabled={loading}
              className="font-mono text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
              style={{ background: 'var(--fg-red)', color: 'white' }}
              data-testid="bulk-confirm-delete">
              {loading ? '...' : 'Yes, Delete'}
            </button>
            <button onClick={() => setConfirming(null)}
              className="font-mono text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all"
              style={{ background: 'white', color: 'var(--fg-text2)', borderColor: 'var(--fg-border2)' }}
              data-testid="bulk-cancel-delete">
              Cancel
            </button>
          </>
        ) : (
          actions.map(a => (
            <button key={a.label} onClick={() => a.color === 'red' ? setConfirming(a.label) : a.onClick()} disabled={loading}
              className="font-mono text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
              style={{ background: a.color === 'green' ? 'var(--fg-green)' : a.color === 'amber' ? '#f59e0b' : 'var(--fg-red)', color: 'white' }}
              data-testid={`bulk-${a.label.toLowerCase().replace(/\s/g, '-')}`}>
              {loading ? '...' : a.label}
            </button>
          ))
        )}
      </div>
    </div>
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
