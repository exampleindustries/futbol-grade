import { useState, useEffect } from 'react'
import { Nav } from '@/components/layout/Nav'
import { ClubBadge } from '@/components/ui/ClubBadge'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase'
import type { FGEvent, Club } from '@/lib/types'

const API = import.meta.env.VITE_API_URL || ''

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysUntil(d: string) {
  const diff = Math.ceil((new Date(d + 'T00:00:00').getTime() - Date.now()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff < 7) return `${diff} days`
  return null
}

function EventCard({ event }: { event: FGEvent }) {
  const soon = daysUntil(event.event_date)
  return (
    <div className="bg-white border rounded-2xl overflow-hidden transition-all hover:shadow-lg"
      style={{ borderColor: 'var(--fg-border)' }} data-testid={`event-${event.id}`}>
      {event.flyer_url && (
        <a href={event.flyer_url} target="_blank" rel="noopener noreferrer" className="block">
          <img src={event.flyer_url} alt={event.title}
            className="w-full h-56 object-cover hover:opacity-90 transition-opacity" />
        </a>
      )}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="font-bebas text-xl tracking-[1px]" style={{ color: 'var(--fg-text)' }}>{event.title.toUpperCase()}</h3>
          {soon && (
            <span className="flex-shrink-0 font-mono text-[10px] font-bold px-2 py-1 rounded-full"
              style={{ background: 'var(--fg-green-pale)', color: 'var(--fg-green)' }}>{soon}</span>
          )}
        </div>
        <div className="flex items-center gap-2 mb-3">
          <span className="font-mono text-[11px] font-semibold" style={{ color: 'var(--fg-green)' }}>
            📅 {formatDate(event.event_date)}
            {event.end_date && event.end_date !== event.event_date && ` – ${formatDate(event.end_date)}`}
          </span>
        </div>
        {event.description && (
          <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--fg-muted)' }}>{event.description}</p>
        )}
        <div className="flex items-center justify-between">
          {event.club && (
            <div className="flex items-center gap-2">
              <ClubBadge clubName={event.club.name} logoUrl={event.club.logo_url} size="xs" />
              <span className="font-mono text-[10px] font-semibold" style={{ color: 'var(--fg-muted)' }}>{event.club.name}</span>
            </div>
          )}
          {event.source === 'club_crawl' && (
            <span className="font-mono text-[9px] px-2 py-0.5 rounded" style={{ background: 'var(--fg-surface)', color: 'var(--fg-muted)' }}>AUTO-FOUND</span>
          )}
        </div>
      </div>
    </div>
  )
}

function UploadFlyerForm({ clubs, onSuccess }: { clubs: Club[]; onSuccess: () => void }) {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [clubId, setClubId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 5 * 1024 * 1024) { setError('File must be under 5MB'); return }
    if (!f.type.startsWith('image/') && f.type !== 'application/pdf') { setError('Only images and PDFs allowed'); return }
    setFile(f)
    setError(null)
    if (f.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => setPreview(reader.result as string)
      reader.readAsDataURL(f)
    } else {
      setPreview(null)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) { setError('You must be logged in to submit a flyer'); return }
    if (!title || !eventDate) { setError('Title and event date are required'); return }
    setUploading(true)
    setError(null)

    try {
      let flyerUrl = null
      if (file) {
        const ext = file.name.split('.').pop() || 'jpg'
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadErr } = await supabase.storage.from('event-flyers').upload(path, file)
        if (uploadErr) throw new Error(uploadErr.message)
        const { data: { publicUrl } } = supabase.storage.from('event-flyers').getPublicUrl(path)
        flyerUrl = publicUrl
      }

      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${API}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          title,
          description: description || null,
          flyer_url: flyerUrl,
          event_date: eventDate,
          end_date: endDate || null,
          club_id: clubId || null,
        }),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || 'Submission failed')
      }
      onSuccess()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  if (!user) {
    return (
      <div className="text-center py-8 px-6 border rounded-2xl" style={{ borderColor: 'var(--fg-border)', background: 'var(--fg-surface)' }}>
        <p className="text-sm mb-3" style={{ color: 'var(--fg-muted)' }}>Sign in to submit event flyers for the community</p>
        <a href="/auth/login" className="inline-block px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'var(--fg-green)' }} data-testid="events-login-cta">Sign In</a>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block font-mono text-[10px] font-bold tracking-widest uppercase mb-1.5" style={{ color: 'var(--fg-muted)' }}>Event Title *</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
            className="w-full border rounded-lg px-4 py-2.5 text-sm outline-none"
            style={{ borderColor: 'var(--fg-border2)', background: 'var(--fg-surface)', color: 'var(--fg-text)' }}
            placeholder="Summer Camp 2026" data-testid="event-title" />
        </div>
        <div>
          <label className="block font-mono text-[10px] font-bold tracking-widest uppercase mb-1.5" style={{ color: 'var(--fg-muted)' }}>Club (optional)</label>
          <select value={clubId} onChange={e => setClubId(e.target.value)}
            className="w-full border rounded-lg px-4 py-2.5 text-sm outline-none"
            style={{ borderColor: 'var(--fg-border2)', background: 'var(--fg-surface)', color: 'var(--fg-text)' }}
            data-testid="event-club">
            <option value="">No specific club</option>
            {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block font-mono text-[10px] font-bold tracking-widest uppercase mb-1.5" style={{ color: 'var(--fg-muted)' }}>Event Date *</label>
          <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} required
            className="w-full border rounded-lg px-4 py-2.5 text-sm outline-none"
            style={{ borderColor: 'var(--fg-border2)', background: 'var(--fg-surface)', color: 'var(--fg-text)' }}
            data-testid="event-date" />
        </div>
        <div>
          <label className="block font-mono text-[10px] font-bold tracking-widest uppercase mb-1.5" style={{ color: 'var(--fg-muted)' }}>End Date (optional)</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="w-full border rounded-lg px-4 py-2.5 text-sm outline-none"
            style={{ borderColor: 'var(--fg-border2)', background: 'var(--fg-surface)', color: 'var(--fg-text)' }}
            data-testid="event-end-date" />
        </div>
      </div>
      <div>
        <label className="block font-mono text-[10px] font-bold tracking-widest uppercase mb-1.5" style={{ color: 'var(--fg-muted)' }}>Description (optional)</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
          className="w-full border rounded-lg px-4 py-2.5 text-sm outline-none resize-none"
          style={{ borderColor: 'var(--fg-border2)', background: 'var(--fg-surface)', color: 'var(--fg-text)' }}
          placeholder="Camp details, location, registration info..." data-testid="event-description" />
      </div>
      <div>
        <label className="block font-mono text-[10px] font-bold tracking-widest uppercase mb-1.5" style={{ color: 'var(--fg-muted)' }}>Flyer Image (optional, max 5MB)</label>
        <input type="file" accept="image/*,application/pdf" onChange={handleFile}
          className="w-full text-sm" style={{ color: 'var(--fg-muted)' }} data-testid="event-flyer-file" />
        {preview && <img src={preview} alt="Preview" className="mt-2 w-40 h-40 object-cover rounded-lg border" style={{ borderColor: 'var(--fg-border)' }} />}
      </div>
      {error && (
        <div className="text-sm font-medium px-4 py-3 rounded-lg border"
          style={{ background: 'var(--fg-red-pale)', color: 'var(--fg-red)', borderColor: 'rgba(192,57,43,.2)' }}>{error}</div>
      )}
      <button type="submit" disabled={uploading}
        className="px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110"
        style={{ background: 'var(--fg-green)', opacity: uploading ? 0.6 : 1 }}
        data-testid="event-submit">
        {uploading ? 'Submitting...' : 'Submit Event Flyer'}
      </button>
    </form>
  )
}

// Success modal
function SuccessModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative bg-white rounded-2xl p-8 max-w-sm mx-4 text-center shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="text-5xl mb-4">✅</div>
        <h3 className="font-bebas text-2xl tracking-[2px] mb-2" style={{ color: 'var(--fg-text)' }}>FLYER SUBMITTED</h3>
        <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--fg-muted)' }}>
          Thank you for your submission. Your event flyer is now under review and will be approved within <strong>1–2 business days</strong>.
        </p>
        <button onClick={onClose}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110"
          style={{ background: 'var(--fg-green)' }}
          data-testid="success-close">
          Got It
        </button>
      </div>
    </div>
  )
}

export default function Events() {
  const [events, setEvents] = useState<FGEvent[]>([])
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    async function load() {
      const [evRes, clRes] = await Promise.all([
        fetch(`${API}/api/events`).then(r => r.json()).catch(() => []),
        supabase.from('clubs').select('*').eq('status', 'approved').order('name'),
      ])
      setEvents(evRes || [])
      setClubs((clRes.data as Club[]) || [])
      setLoading(false)
    }
    load()
  }, [])

  function handleUploadSuccess() {
    setShowUpload(false)
    setShowSuccess(true)
  }

  return (
    <div style={{ background: 'var(--fg-bg)', minHeight: '100vh' }}>
      <Nav />
      <SuccessModal open={showSuccess} onClose={() => setShowSuccess(false)} />

      {/* Header */}
      <section className="border-b" style={{ borderColor: 'var(--fg-border)', background: 'var(--fg-surface)' }}>
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2.5 h-2.5 rounded-full rating-pulse" style={{ background: 'var(--fg-green)' }} />
            <span className="font-mono text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--fg-green)' }}>Community Events</span>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="font-bebas text-4xl tracking-[3px]" style={{ color: 'var(--fg-text)' }}>EVENTS &amp; PROGRAMS</h1>
              <p className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>Camps, clinics, tournaments, and training programs across SoCal</p>
            </div>
            <button onClick={() => setShowUpload(!showUpload)}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110"
              style={{ background: 'var(--fg-green)', boxShadow: '0 4px 16px rgba(26,110,56,.25)' }}
              data-testid="toggle-upload">
              {showUpload ? 'Cancel' : '📤 Submit a Flyer'}
            </button>
          </div>
        </div>
      </section>

      {/* Upload Form */}
      {showUpload && (
        <section className="border-b" style={{ borderColor: 'var(--fg-border)', background: '#f7f5f0' }}>
          <div className="max-w-3xl mx-auto px-6 py-8">
            <h2 className="font-bebas text-xl tracking-[2px] mb-4" style={{ color: 'var(--fg-text)' }}>SUBMIT EVENT FLYER</h2>
            <UploadFlyerForm clubs={clubs} onSuccess={handleUploadSuccess} />
          </div>
        </section>
      )}

      {/* Events Grid */}
      <section className="py-12">
        <div className="max-w-6xl mx-auto px-6">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-2xl p-5 animate-pulse border" style={{ borderColor: 'var(--fg-border)', height: 280 }} />
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">🏟️</div>
              <h3 className="font-bebas text-2xl tracking-[2px] mb-2" style={{ color: 'var(--fg-text)' }}>NO UPCOMING EVENTS</h3>
              <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>Be the first to share an event with the SoCal soccer community</p>
              {!showUpload && (
                <button onClick={() => setShowUpload(true)}
                  className="mt-4 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                  style={{ background: 'var(--fg-green)' }}>
                  📤 Submit a Flyer
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map(ev => <EventCard key={ev.id} event={ev} />)}
            </div>
          )}
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
    </div>
  )
}
