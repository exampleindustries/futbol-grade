import { useState } from 'react'
import { Nav } from '@/components/layout/Nav'
import { useAuth } from '@/hooks/use-auth'

// ── Team data by league ─────────────────────────────────────────
const LEAGUES: Record<string, string[]> = {
  'Premier League': [
    'Arsenal', 'Aston Villa', 'Bournemouth', 'Brentford', 'Brighton',
    'Chelsea', 'Crystal Palace', 'Everton', 'Fulham', 'Ipswich Town',
    'Leicester City', 'Liverpool', 'Manchester City', 'Manchester United',
    'Newcastle United', 'Nottingham Forest', 'Southampton', 'Tottenham',
    'West Ham United', 'Wolverhampton',
  ],
  'Champions League': [
    'AC Milan', 'Arsenal', 'Atletico Madrid', 'Barcelona', 'Bayern Munich',
    'Benfica', 'Borussia Dortmund', 'Celtic', 'Chelsea', 'Club Brugge',
    'Inter Milan', 'Juventus', 'Liverpool', 'Manchester City',
    'Napoli', 'Paris Saint-Germain', 'Porto', 'PSV Eindhoven',
    'Real Madrid', 'RB Leipzig',
  ],
  'MLS': [
    'Atlanta United', 'Austin FC', 'Charlotte FC', 'Chicago Fire',
    'Cincinnati FC', 'Colorado Rapids', 'Columbus Crew', 'DC United',
    'Dallas FC', 'Houston Dynamo', 'Inter Miami', 'LA Galaxy',
    'LAFC', 'Minnesota United', 'Montreal CF', 'Nashville SC',
    'New England Revolution', 'New York City FC', 'New York Red Bulls',
    'Orlando City', 'Philadelphia Union', 'Portland Timbers',
    'Real Salt Lake', 'San Jose Earthquakes', 'Seattle Sounders',
    'Sporting Kansas City', 'St. Louis City SC', 'Toronto FC',
    'Vancouver Whitecaps',
  ],
}

const LEAGUE_KEYS = Object.keys(LEAGUES)

export default function Register() {
  const { signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [league, setLeague] = useState('')
  const [team, setTeam] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const teams = league ? LEAGUES[league] || [] : []

  function handleLeagueChange(val: string) {
    setLeague(val)
    setTeam('')
  }

  // Preview the username
  const previewAlias = team
    ? `${team.replace(/[^a-zA-Z0-9]/g, '')}_Fan${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (!league || !team) { setError('Please select your favorite league and team'); return }
    setLoading(true)
    try {
      await signUp(email, password, { favorite_league: league, favorite_team: team })
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
              {team && (
                <div className="mt-4 px-4 py-3 rounded-xl border" style={{ borderColor: 'var(--fg-green)', background: 'var(--fg-green-pale)' }}>
                  <span className="font-mono text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--fg-green)' }}>Your username</span>
                  <div className="font-bebas text-xl tracking-[1px] mt-1" style={{ color: 'var(--fg-text)' }}>
                    {team.replace(/[^a-zA-Z0-9]/g, '')}_Fan****
                  </div>
                </div>
              )}
              <a href="/auth/login" className="inline-block mt-6 px-6 py-3 rounded-xl text-sm font-semibold text-white" style={{ background: 'var(--fg-green)' }}>
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

                {/* League / Team selector */}
                <div className="pt-2 border-t" style={{ borderColor: 'var(--fg-border)' }}>
                  <span className="block font-mono text-[10px] font-bold tracking-widest uppercase mb-3" style={{ color: 'var(--fg-green)' }}>
                    ⚽ Pick Your Favorite Team
                  </span>
                  <div>
                    <label className="block font-mono text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--fg-muted)' }}>League</label>
                    <select value={league} onChange={e => handleLeagueChange(e.target.value)}
                      className="w-full border rounded-lg px-4 py-2.5 text-sm outline-none"
                      style={{ borderColor: 'var(--fg-border2)', background: 'var(--fg-surface)', color: 'var(--fg-text)' }}
                      data-testid="register-league">
                      <option value="">Select a league...</option>
                      {LEAGUE_KEYS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  {league && (
                    <div className="mt-3">
                      <label className="block font-mono text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--fg-muted)' }}>Team</label>
                      <select value={team} onChange={e => setTeam(e.target.value)}
                        className="w-full border rounded-lg px-4 py-2.5 text-sm outline-none"
                        style={{ borderColor: 'var(--fg-border2)', background: 'var(--fg-surface)', color: 'var(--fg-text)' }}
                        data-testid="register-team">
                        <option value="">Select a team...</option>
                        {teams.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Username preview */}
                  {team && (
                    <div className="mt-3 px-4 py-3 rounded-xl border" style={{ borderColor: 'var(--fg-border)', background: 'var(--fg-surface)' }}>
                      <span className="font-mono text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--fg-muted)' }}>Your username will be</span>
                      <div className="font-bebas text-lg tracking-[1px] mt-1" style={{ color: 'var(--fg-text)' }}>
                        {previewAlias}
                      </div>
                      <span className="font-mono text-[9px]" style={{ color: 'var(--fg-muted)' }}>* Numbers are randomly assigned</span>
                    </div>
                  )}
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
                <a href="/auth/login" className="text-sm font-semibold" style={{ color: 'var(--fg-green)' }}>Log In</a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
