import { useState } from 'react'
import { Nav } from '@/components/layout/Nav'
import { useAuth } from '@/hooks/use-auth'

export default function Register() {
  const { signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      await signUp(email, password)
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Registration failed')
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
              <div className="text-4xl mb-3">📬</div>
              <h2 className="font-bebas text-2xl tracking-[2px] mb-2" style={{ color: 'var(--fg-text)' }}>CHECK YOUR EMAIL</h2>
              <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
                We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
              </p>
              <a href="/#/auth/login" className="inline-block mt-6 px-6 py-3 rounded-xl text-sm font-semibold text-white" style={{ background: 'var(--fg-green)' }}>
                Go to Login →
              </a>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <h1 className="font-bebas text-3xl tracking-[2px]" style={{ color: 'var(--fg-text)' }}>SIGN UP</h1>
                <p className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>Join the Futbol Grade community</p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block font-mono text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--fg-muted)' }}>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                    className="w-full border rounded-lg px-4 py-2.5 text-sm outline-none"
                    style={{ borderColor: 'var(--fg-border2)', background: 'var(--fg-surface)', color: 'var(--fg-text)' }}
                    data-testid="register-email" />
                </div>
                <div>
                  <label className="block font-mono text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--fg-muted)' }}>Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                    className="w-full border rounded-lg px-4 py-2.5 text-sm outline-none"
                    style={{ borderColor: 'var(--fg-border2)', background: 'var(--fg-surface)', color: 'var(--fg-text)' }}
                    data-testid="register-password" />
                </div>
                <div>
                  <label className="block font-mono text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--fg-muted)' }}>Confirm Password</label>
                  <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
                    className="w-full border rounded-lg px-4 py-2.5 text-sm outline-none"
                    style={{ borderColor: 'var(--fg-border2)', background: 'var(--fg-surface)', color: 'var(--fg-text)' }}
                    data-testid="register-confirm" />
                </div>
                {error && (
                  <div className="text-sm font-medium px-4 py-3 rounded-lg border"
                    style={{ background: 'var(--fg-red-pale)', color: 'var(--fg-red)', borderColor: 'rgba(192,57,43,.2)' }}>{error}</div>
                )}
                <button type="submit" disabled={loading}
                  className="w-full py-3 rounded-xl font-bold text-sm text-white" style={{ background: 'var(--fg-green)' }}
                  data-testid="register-submit">
                  {loading ? 'Creating account…' : 'Create Account'}
                </button>
              </form>
              <div className="text-center mt-6">
                <span className="text-sm" style={{ color: 'var(--fg-muted)' }}>Already have an account? </span>
                <a href="/#/auth/login" className="text-sm font-semibold" style={{ color: 'var(--fg-green)' }}>Log In</a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
