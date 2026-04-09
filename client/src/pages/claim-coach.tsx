import { useState, useEffect } from 'react'
import { useRoute, useLocation } from 'wouter'
import { supabase } from '@/lib/supabase'
import { Nav } from '@/components/layout/Nav'
import { useAuth } from '@/hooks/use-auth'
import { initials, fullName } from '@/lib/fg-utils'
import type { Coach } from '@/lib/types'

function getApiBase() {
  const base = "__PORT_5000__"
  return base.startsWith("__") ? "" : base
}

export default function ClaimCoach() {
  const [, params] = useRoute('/coaches/:id/claim')
  const id = params?.id
  const { user } = useAuth()
  const [, setLocation] = useLocation()
  const [coach, setCoach] = useState<Coach | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [alreadyClaimed, setAlreadyClaimed] = useState(false)

  // Form state
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [verificationNote, setVerificationNote] = useState('')

  useEffect(() => {
    if (!id) return
    async function load() {
      const { data } = await supabase.from('coaches').select('*, club:clubs(id, name)').eq('id', id).single()
      const c = data as Coach | null
      setCoach(c)
      if (c?.user_id) setAlreadyClaimed(true)
      setLoading(false)
    }
    load()
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !coach) return
    setError('')
    setSubmitting(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${getApiBase()}/api/claims`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          coach_id: coach.id,
          email,
          phone: phone || undefined,
          license_number: licenseNumber || undefined,
          verification_note: verificationNote || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to submit claim')
      }

      setSubmitted(true)
    } catch (err: any) {
      setError(err.message)
    }
    setSubmitting(false)
  }

  if (loading) return (
    <div style={{ background: 'var(--fg-bg)', minHeight: '100vh' }}>
      <Nav />
      <div className="max-w-lg mx-auto px-6 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-48" />
          <div className="h-4 bg-gray-200 rounded w-32" />
        </div>
      </div>
    </div>
  )

  if (!coach) return (
    <div style={{ background: 'var(--fg-bg)', minHeight: '100vh' }}>
      <Nav />
      <div className="max-w-lg mx-auto px-6 py-20 text-center">
        <div className="text-4xl mb-3">⚽</div>
        <h2 className="font-bebas text-2xl" style={{ color: 'var(--fg-text)' }}>Coach Not Found</h2>
      </div>
    </div>
  )

  if (!user) return (
    <div style={{ background: 'var(--fg-bg)', minHeight: '100vh' }}>
      <Nav />
      <div className="max-w-lg mx-auto px-6 py-20 text-center">
        <div className="text-4xl mb-3">🔑</div>
        <h2 className="font-bebas text-2xl mb-2" style={{ color: 'var(--fg-text)' }}>Sign In Required</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--fg-muted)' }}>Create an account or log in to claim this coach profile.</p>
        <a href="#/auth/login" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'var(--fg-green)' }} data-testid="login-to-claim">
          Log In
        </a>
      </div>
    </div>
  )

  if (alreadyClaimed) return (
    <div style={{ background: 'var(--fg-bg)', minHeight: '100vh' }}>
      <Nav />
      <div className="max-w-lg mx-auto px-6 py-20 text-center">
        <div className="text-4xl mb-3">✅</div>
        <h2 className="font-bebas text-2xl mb-2" style={{ color: 'var(--fg-text)' }}>Profile Already Claimed</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--fg-muted)' }}>This coach profile has already been verified.</p>
        <a href={`#/coaches/${coach.id}`} className="font-mono text-xs font-semibold hover:underline" style={{ color: 'var(--fg-green)' }}>
          ← Back to profile
        </a>
      </div>
    </div>
  )

  if (submitted) return (
    <div style={{ background: 'var(--fg-bg)', minHeight: '100vh' }}>
      <Nav />
      <div className="max-w-lg mx-auto px-6 py-20 text-center">
        <div className="text-4xl mb-3">🎉</div>
        <h2 className="font-bebas text-2xl mb-2" style={{ color: 'var(--fg-text)' }}>Claim Submitted</h2>
        <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
          We'll review your claim and verify your identity. You'll receive an email at <strong style={{ color: 'var(--fg-text)' }}>{email}</strong> once approved.
        </p>
        <a href={`#/coaches/${coach.id}`} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'var(--fg-green)' }} data-testid="back-to-profile">
          Back to Profile
        </a>
      </div>
    </div>
  )

  return (
    <div style={{ background: 'var(--fg-bg)', minHeight: '100vh' }}>
      <Nav />
      <div className="max-w-lg mx-auto px-6 py-8">
        {/* Back link */}
        <a href={`#/coaches/${coach.id}`} className="inline-flex items-center gap-1 font-mono text-xs font-semibold mb-6 hover:underline"
          style={{ color: 'var(--fg-green)' }} data-testid="back-link">
          ← {coach.first_name} {coach.last_name}
        </a>

        {/* Header card */}
        <div className="bg-white border rounded-2xl p-6 mb-6" style={{ borderColor: 'var(--fg-border)' }}>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-bebas text-xl border-2 flex-shrink-0"
              style={{ background: 'var(--fg-green-pale)', color: 'var(--fg-green)', borderColor: 'var(--fg-border)' }}>
              {initials(coach.first_name, coach.last_name)}
            </div>
            <div>
              <h1 className="font-bebas text-2xl tracking-[2px] leading-tight" style={{ color: 'var(--fg-text)' }}>
                CLAIM PROFILE
              </h1>
              <div className="font-mono text-xs" style={{ color: 'var(--fg-muted)' }}>
                {coach.first_name} {coach.last_name}
                {coach.club && ` · ${(coach.club as any).name}`}
              </div>
            </div>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-text2)' }}>
            Are you <strong>{coach.first_name} {coach.last_name}</strong>? Claim this profile to receive review notifications, update your info, and show a verified badge.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white border rounded-2xl p-6 space-y-5" style={{ borderColor: 'var(--fg-border)' }}>
          <h3 className="font-mono text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--fg-muted)' }}>Verification Details</h3>

          {/* Email */}
          <div>
            <label className="block font-mono text-[11px] font-semibold mb-1.5" style={{ color: 'var(--fg-text)' }}>
              Email Address <span style={{ color: 'var(--fg-red)' }}>*</span>
            </label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="your.name@email.com"
              className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-colors focus:ring-2"
              style={{ borderColor: 'var(--fg-border)', color: 'var(--fg-text)', background: 'var(--fg-surface)' }}
              data-testid="input-email" />
            <p className="font-mono text-[10px] mt-1" style={{ color: 'var(--fg-muted)' }}>
              We'll use this to send you review notifications
            </p>
          </div>

          {/* Phone */}
          <div>
            <label className="block font-mono text-[11px] font-semibold mb-1.5" style={{ color: 'var(--fg-text)' }}>
              Phone Number
            </label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 123-4567"
              className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-colors focus:ring-2"
              style={{ borderColor: 'var(--fg-border)', color: 'var(--fg-text)', background: 'var(--fg-surface)' }}
              data-testid="input-phone" />
          </div>

          {/* License */}
          <div>
            <label className="block font-mono text-[11px] font-semibold mb-1.5" style={{ color: 'var(--fg-text)' }}>
              Coaching License / ID
            </label>
            <input type="text" value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} placeholder="e.g. USSF C License, US Soccer D"
              className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-colors focus:ring-2"
              style={{ borderColor: 'var(--fg-border)', color: 'var(--fg-text)', background: 'var(--fg-surface)' }}
              data-testid="input-license" />
          </div>

          {/* Verification note */}
          <div>
            <label className="block font-mono text-[11px] font-semibold mb-1.5" style={{ color: 'var(--fg-text)' }}>
              How can we verify you?
            </label>
            <textarea value={verificationNote} onChange={e => setVerificationNote(e.target.value)}
              placeholder="e.g. I coach U14 at this club, you can reach me at..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-colors focus:ring-2 resize-none"
              style={{ borderColor: 'var(--fg-border)', color: 'var(--fg-text)', background: 'var(--fg-surface)' }}
              data-testid="input-verification" />
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm px-4 py-3 rounded-lg border" style={{ color: 'var(--fg-red)', background: 'var(--fg-red-pale)', borderColor: 'rgba(192,57,43,.2)' }}
              data-testid="error-message">
              {error}
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={submitting}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
            style={{ background: 'var(--fg-green)', boxShadow: '0 4px 16px rgba(26,110,56,.25)' }}
            data-testid="submit-claim">
            {submitting ? 'Submitting...' : 'Submit Claim Request'}
          </button>
        </form>
      </div>
    </div>
  )
}
