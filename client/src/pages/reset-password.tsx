import { useState, useEffect } from 'react'
import { Nav } from '@/components/layout/Nav'
import { supabase } from '@/lib/supabase'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    // Supabase injects the recovery token via the URL hash fragment.
    // The client picks it up automatically via onAuthStateChange.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true)
      }
    })
    // Also check if there's already a session (user clicked link and session was restored)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ background: 'var(--fg-bg)', minHeight: '100vh' }}>
      <Nav />
      <div className="max-w-md mx-auto px-6 py-16">
        <div className="bg-white border rounded-2xl p-8" style={{ borderColor: 'var(--fg-border)' }}>
          {success ? (
            <div className="text-center">
              <div className="text-4xl mb-3">✅</div>
              <h2 className="font-bebas text-2xl tracking-[2px] mb-2" style={{ color: 'var(--fg-text)' }}>PASSWORD UPDATED</h2>
              <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
                Your password has been reset. You can now log in with your new password.
              </p>
              <a href="/auth/login" className="inline-block mt-6 px-6 py-3 rounded-xl text-sm font-semibold text-white"
                style={{ background: 'var(--fg-green)' }} data-testid="go-to-login">
                Log In →
              </a>
            </div>
          ) : !sessionReady ? (
            <div className="text-center">
              <div className="text-4xl mb-3">🔑</div>
              <h2 className="font-bebas text-2xl tracking-[2px] mb-2" style={{ color: 'var(--fg-text)' }}>VERIFYING LINK</h2>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
                Processing your reset link. If this takes more than a few seconds, the link may have expired.
              </p>
              <a href="/auth/forgot-password" className="inline-block mt-6 text-sm font-semibold" style={{ color: 'var(--fg-green)' }}>
                Request a New Link →
              </a>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <h1 className="font-bebas text-3xl tracking-[2px]" style={{ color: 'var(--fg-text)' }}>NEW PASSWORD</h1>
                <p className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>Choose a new password for your account</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block font-mono text-[10px] font-bold tracking-widest uppercase mb-2"
                    style={{ color: 'var(--fg-muted)' }}>New Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                    className="w-full border rounded-lg px-4 py-2.5 text-sm outline-none"
                    style={{ borderColor: 'var(--fg-border2)', background: 'var(--fg-surface)', color: 'var(--fg-text)' }}
                    placeholder="At least 6 characters"
                    data-testid="reset-password" />
                </div>
                <div>
                  <label className="block font-mono text-[10px] font-bold tracking-widest uppercase mb-2"
                    style={{ color: 'var(--fg-muted)' }}>Confirm Password</label>
                  <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
                    className="w-full border rounded-lg px-4 py-2.5 text-sm outline-none"
                    style={{ borderColor: 'var(--fg-border2)', background: 'var(--fg-surface)', color: 'var(--fg-text)' }}
                    data-testid="reset-confirm" />
                </div>

                {error && (
                  <div className="text-sm font-medium px-4 py-3 rounded-lg border"
                    style={{ background: 'var(--fg-red-pale)', color: 'var(--fg-red)', borderColor: 'rgba(192,57,43,.2)' }}>{error}</div>
                )}

                <button type="submit" disabled={loading}
                  className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50"
                  style={{ background: 'var(--fg-green)' }}
                  data-testid="reset-submit">
                  {loading ? 'Updating…' : 'Set New Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
