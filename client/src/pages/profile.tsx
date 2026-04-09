import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Nav } from '@/components/layout/Nav'
import { useAuth } from '@/hooks/use-auth'
import { generateAlias } from '@/lib/fg-utils'

export default function Profile() {
  const { user, profile, loading: authLoading } = useAuth()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [alias, setAlias] = useState('')
  const [aliasEmoji, setAliasEmoji] = useState('⚽')
  const [preferAnon, setPreferAnon] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || '')
      setLastName(profile.last_name || '')
      setAlias(profile.alias || '')
      setAliasEmoji(profile.alias_emoji || '⚽')
      setPreferAnon(profile.prefer_anonymous)
    }
  }, [profile])

  if (authLoading) return (
    <div style={{ background: 'var(--fg-bg)', minHeight: '100vh' }}><Nav />
      <div className="max-w-lg mx-auto px-6 py-12"><div className="animate-pulse h-8 bg-gray-200 rounded w-1/2" /></div>
    </div>
  )

  if (!user) { window.location.href = '/auth/login'; return null }

  function regenAlias() {
    const a = generateAlias()
    setAlias(a.name)
    setAliasEmoji(a.emoji)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('profiles').update({
      first_name: firstName || null,
      last_name: lastName || null,
      alias, alias_emoji: aliasEmoji,
      prefer_anonymous: preferAnon,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div style={{ background: 'var(--fg-bg)', minHeight: '100vh' }}>
      <Nav />
      <div className="max-w-lg mx-auto px-6 py-8">
        <h1 className="font-bebas text-3xl tracking-[2px] mb-6" style={{ color: 'var(--fg-text)' }}>MY PROFILE</h1>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-white border rounded-2xl p-6" style={{ borderColor: 'var(--fg-border)' }}>
            <h3 className="font-mono text-[10px] font-bold tracking-widest uppercase mb-4" style={{ color: 'var(--fg-muted)' }}>Personal Info</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--fg-text2)' }}>First Name</label>
                <input value={firstName} onChange={e => setFirstName(e.target.value)}
                  className="w-full border rounded-lg px-4 py-2.5 text-sm outline-none"
                  style={{ borderColor: 'var(--fg-border2)', background: 'var(--fg-surface)', color: 'var(--fg-text)' }}
                  data-testid="profile-first-name" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--fg-text2)' }}>Last Name</label>
                <input value={lastName} onChange={e => setLastName(e.target.value)}
                  className="w-full border rounded-lg px-4 py-2.5 text-sm outline-none"
                  style={{ borderColor: 'var(--fg-border2)', background: 'var(--fg-surface)', color: 'var(--fg-text)' }}
                  data-testid="profile-last-name" />
              </div>
            </div>
            <div className="mt-3 text-xs font-mono" style={{ color: 'var(--fg-muted)' }}>Email: {user.email}</div>
          </div>

          <div className="bg-white border rounded-2xl p-6" style={{ borderColor: 'var(--fg-border)' }}>
            <h3 className="font-mono text-[10px] font-bold tracking-widest uppercase mb-4" style={{ color: 'var(--fg-muted)' }}>Review Identity</h3>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl border"
                style={{ background: 'var(--fg-green-pale)', borderColor: 'var(--fg-border)' }}>{aliasEmoji}</div>
              <div className="flex-1">
                <input value={alias} onChange={e => setAlias(e.target.value)}
                  className="w-full border rounded-lg px-4 py-2.5 text-sm outline-none font-mono font-bold"
                  style={{ borderColor: 'var(--fg-border2)', background: 'var(--fg-surface)', color: 'var(--fg-text)' }}
                  data-testid="profile-alias" />
              </div>
              <button type="button" onClick={regenAlias}
                className="font-mono text-xs px-3 py-2 rounded-lg border font-semibold"
                style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-text2)' }}
                data-testid="profile-regen-alias">↻ Randomize</button>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={preferAnon} onChange={e => setPreferAnon(e.target.checked)}
                className="w-4 h-4 rounded" data-testid="profile-anon-toggle" />
              <span className="text-sm" style={{ color: 'var(--fg-text2)' }}>Default to anonymous when posting reviews</span>
            </label>
          </div>

          {saved && (
            <div className="text-sm font-medium px-4 py-3 rounded-lg border text-center"
              style={{ background: 'var(--fg-green-pale)', color: 'var(--fg-green)', borderColor: 'rgba(26,110,56,.2)' }}>
              Profile saved successfully
            </div>
          )}

          <button type="submit" disabled={saving}
            className="w-full py-3 rounded-xl font-bold text-sm text-white" style={{ background: 'var(--fg-green)' }}
            data-testid="profile-save">
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  )
}
