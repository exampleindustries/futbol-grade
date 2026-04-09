import { useState } from 'react'
import { Nav } from '@/components/layout/Nav'
import { supabase } from '@/lib/supabase'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const redirectBase = window.location.origin
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${redirectBase}/auth/reset-password`,
      })
      if (error) throw error
      setSent(true)
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ background: 'var(--fg-bg)', minHeight: '100vh' }}>
      <Nav />
      <div className="max-w-md mx-auto px-6 py-16">
        <div className="bg-white border rounded-2xl p-8" style={{ borderColor: 'var(--fg-border)' }}>
          {sent ? (
            <div className="text-center">
              <div className="text-4xl mb-3">📬</div>
              <h2 className="font-bebas text-2xl tracking-[2px] mb-2" style={{ color: 'var(--fg-text)' }}>CHECK YOUR EMAIL</h2>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
                We sent a password reset link to <strong style={{ color: 'var(--fg-text)' }}>{email}</strong>. Click it to set a new password.
              </p>
              <p className="text-xs mt-4" style={{ color: 'var(--fg-muted)' }}>
                Didn't receive it? Check your spam folder or try again.
              </p>
              <div className="flex gap-3 justify-center mt-6">
                <button onClick={() => { setSent(false); setEmail('') }}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold border transition-all"
                  style={{ color: 'var(--fg-green)', borderColor: 'var(--fg-green)' }}
                  data-testid="try-again">
                  Try Again
                </button>
                <a href="/auth/login" className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                  style={{ background: 'var(--fg-green)' }} data-testid="back-to-login">
                  Back to Login
                </a>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <h1 className="font-bebas text-3xl tracking-[2px]" style={{ color: 'var(--fg-text)' }}>RESET PASSWORD</h1>
                <p className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>Enter your email and we'll send a reset link</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block font-mono text-[10px] font-bold tracking-widest uppercase mb-2"
                    style={{ color: 'var(--fg-muted)' }}>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                    className="w-full border rounded-lg px-4 py-2.5 text-sm outline-none"
                    style={{ borderColor: 'var(--fg-border2)', background: 'var(--fg-surface)', color: 'var(--fg-text)' }}
                    placeholder="you@email.com"
                    data-testid="forgot-email" />
                </div>

                {error && (
                  <div className="text-sm font-medium px-4 py-3 rounded-lg border"
                    style={{ background: 'var(--fg-red-pale)', color: 'var(--fg-red)', borderColor: 'rgba(192,57,43,.2)' }}>{error}</div>
                )}

                <button type="submit" disabled={loading}
                  className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50"
                  style={{ background: 'var(--fg-green)' }}
                  data-testid="forgot-submit">
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>

              <div className="text-center mt-6">
                <a href="/auth/login" className="text-sm font-semibold" style={{ color: 'var(--fg-green)' }}>
                  ← Back to Login
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
