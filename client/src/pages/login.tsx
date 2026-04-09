import { useState } from 'react'
import { Nav } from '@/components/layout/Nav'
import { useAuth } from '@/hooks/use-auth'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signIn(email, password)
      window.location.hash = '#/'
    } catch (err: any) {
      setError(err.message || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ background: 'var(--fg-bg)', minHeight: '100vh' }}>
      <Nav />
      <div className="max-w-md mx-auto px-6 py-16">
        <div className="bg-white border rounded-2xl p-8" style={{ borderColor: 'var(--fg-border)' }}>
          <div className="text-center mb-6">
            <h1 className="font-bebas text-3xl tracking-[2px]" style={{ color: 'var(--fg-text)' }}>LOG IN</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>Welcome back to Futbol Grade</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-mono text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--fg-muted)' }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full border rounded-lg px-4 py-2.5 text-sm outline-none"
                style={{ borderColor: 'var(--fg-border2)', background: 'var(--fg-surface)', color: 'var(--fg-text)' }}
                data-testid="login-email" />
            </div>
            <div>
              <label className="block font-mono text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--fg-muted)' }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full border rounded-lg px-4 py-2.5 text-sm outline-none"
                style={{ borderColor: 'var(--fg-border2)', background: 'var(--fg-surface)', color: 'var(--fg-text)' }}
                data-testid="login-password" />
            </div>

            {error && (
              <div className="text-sm font-medium px-4 py-3 rounded-lg border"
                style={{ background: 'var(--fg-red-pale)', color: 'var(--fg-red)', borderColor: 'rgba(192,57,43,.2)' }}>{error}</div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all"
              style={{ background: 'var(--fg-green)' }}
              data-testid="login-submit">
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="text-center mt-6">
            <span className="text-sm" style={{ color: 'var(--fg-muted)' }}>Don't have an account? </span>
            <a href="#/auth/register" className="text-sm font-semibold" style={{ color: 'var(--fg-green)' }} data-testid="link-register">Sign Up</a>
          </div>
        </div>
      </div>
    </div>
  )
}
