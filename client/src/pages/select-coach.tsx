import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { apiRequest } from '@/lib/queryClient'
import { Nav } from '@/components/layout/Nav'
import { useAuth } from '@/hooks/use-auth'
import type { Club, Coach } from '@/lib/types'

const AGE_GROUPS = ['U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'U19']

export default function SelectCoach() {
  const { user, loading: authLoading } = useAuth()
  const [clubs, setClubs] = useState<Club[]>([])
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [selectedClub, setSelectedClub] = useState('')
  const [selectedCoach, setSelectedCoach] = useState('')
  const [addingNew, setAddingNew] = useState(false)
  const [newFirst, setNewFirst] = useState('')
  const [newLast, setNewLast] = useState('')
  const [ageGroup, setAgeGroup] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('clubs').select('id, name, city').eq('status', 'approved').eq('region', 'socal').order('name')
      .then(({ data }) => setClubs((data as Club[]) || []))
  }, [])

  useEffect(() => {
    if (!selectedClub) { setCoaches([]); setSelectedCoach(''); setAddingNew(false); return }
    supabase.from('coaches').select('id, first_name, last_name').eq('club_id', selectedClub).eq('status', 'approved').order('last_name')
      .then(({ data }) => setCoaches((data as Coach[]) || []))
    setSelectedCoach('')
    setAddingNew(false)
  }, [selectedClub])

  if (authLoading) return (
    <div style={{ background: 'var(--fg-bg)', minHeight: '100vh' }}><Nav />
      <div className="max-w-lg mx-auto px-6 py-12"><div className="animate-pulse h-8 bg-gray-200 rounded w-1/2" /></div>
    </div>
  )

  if (!user) {
    window.location.href = '/auth/login'
    return null
  }

  function handleCoachChange(val: string) {
    if (val === '__new__') {
      setAddingNew(true)
      setSelectedCoach('')
    } else {
      setAddingNew(false)
      setSelectedCoach(val)
    }
  }

  async function handleContinue() {
    if (addingNew) {
      if (!newFirst.trim() || !newLast.trim()) { setError('Enter the coach\'s first and last name'); return }
      setCreating(true)
      setError('')
      try {
        const session = await supabase.auth.getSession()
        const token = session.data.session?.access_token
        const res = await fetch(
          `${'https://web-production-67f2.up.railway.app'}/api/admin/coaches`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }
        )
        // Create coach directly via Supabase (pending status, admin will approve)
        const { data, error: err } = await supabase.from('coaches').insert({
          first_name: newFirst.trim(),
          last_name: newLast.trim(),
          club_id: selectedClub,
          city: clubs.find(c => c.id === selectedClub)?.city || null,
          state: 'CA',
          region: 'socal',
          age_groups: ageGroup ? [ageGroup] : [],
          status: 'pending',
        }).select().single()
        if (err) throw err
        window.location.href = `/coaches/${data.id}/review`
      } catch (err: any) {
        setError(err.message || 'Failed to create coach')
      } finally {
        setCreating(false)
      }
    } else {
      if (!selectedCoach) { setError('Select a coach'); return }
      window.location.href = `/coaches/${selectedCoach}/review`
    }
  }

  const selectStyle = {
    borderColor: 'var(--fg-border2)',
    background: 'var(--fg-surface)',
    color: 'var(--fg-text)',
  }

  return (
    <div style={{ background: 'var(--fg-bg)', minHeight: '100vh' }}>
      <Nav />
      <div className="max-w-lg mx-auto px-6 py-10">
        <div className="mb-6">
          <span className="font-mono text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--fg-green)' }}>Write a Review</span>
          <h1 className="font-bebas text-3xl tracking-[2px] mt-1" style={{ color: 'var(--fg-text)' }}>SELECT A COACH</h1>
        </div>

        <div className="bg-white border rounded-2xl p-6 space-y-5" style={{ borderColor: 'var(--fg-border)' }}>
          {/* Club */}
          <div>
            <label className="block font-mono text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--fg-muted)' }}>
              Club <span style={{ color: 'var(--fg-red)' }}>*</span>
            </label>
            <select value={selectedClub} onChange={e => setSelectedClub(e.target.value)}
              className="w-full border rounded-lg px-4 py-2.5 text-sm outline-none" style={selectStyle}
              data-testid="select-club">
              <option value="">Choose a club...</option>
              {clubs.map(c => (
                <option key={c.id} value={c.id}>{c.name} — {c.city}</option>
              ))}
            </select>
          </div>

          {/* Coach */}
          {selectedClub && (
            <div>
              <label className="block font-mono text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--fg-muted)' }}>
                Coach <span style={{ color: 'var(--fg-red)' }}>*</span>
              </label>
              <select value={addingNew ? '__new__' : selectedCoach} onChange={e => handleCoachChange(e.target.value)}
                className="w-full border rounded-lg px-4 py-2.5 text-sm outline-none" style={selectStyle}
                data-testid="select-coach">
                <option value="">Choose a coach...</option>
                {coaches.map(c => (
                  <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                ))}
                <option value="__new__">+ Add New Coach</option>
              </select>
            </div>
          )}

          {/* Add New Coach fields */}
          {addingNew && (
            <div className="border rounded-xl p-4 space-y-4" style={{ borderColor: 'var(--fg-green)', background: 'var(--fg-green-pale)' }}>
              <div className="font-mono text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--fg-green)' }}>New Coach Details</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-[10px] font-bold tracking-widest uppercase mb-1.5" style={{ color: 'var(--fg-muted)' }}>First Name</label>
                  <input value={newFirst} onChange={e => setNewFirst(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none"
                    style={{ borderColor: 'var(--fg-border2)', background: 'white', color: 'var(--fg-text)' }}
                    placeholder="e.g. Marco"
                    data-testid="new-coach-first" />
                </div>
                <div>
                  <label className="block font-mono text-[10px] font-bold tracking-widest uppercase mb-1.5" style={{ color: 'var(--fg-muted)' }}>Last Name</label>
                  <input value={newLast} onChange={e => setNewLast(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none"
                    style={{ borderColor: 'var(--fg-border2)', background: 'white', color: 'var(--fg-text)' }}
                    placeholder="e.g. Rivera"
                    data-testid="new-coach-last" />
                </div>
              </div>
              <p className="font-mono text-[10px]" style={{ color: 'var(--fg-muted)' }}>
                New coaches are reviewed by admin before their profile goes public.
              </p>
            </div>
          )}

          {/* Age Group */}
          {selectedClub && (
            <div>
              <label className="block font-mono text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--fg-muted)' }}>
                Age Group
              </label>
              <div className="flex flex-wrap gap-2">
                {AGE_GROUPS.map(ag => (
                  <button key={ag} type="button" onClick={() => setAgeGroup(ageGroup === ag ? '' : ag)}
                    className="font-mono text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all"
                    style={ageGroup === ag
                      ? { background: 'var(--fg-green)', color: 'white', borderColor: 'var(--fg-green)' }
                      : { background: 'var(--fg-surface)', color: 'var(--fg-text2)', borderColor: 'var(--fg-border2)' }}
                    data-testid={`age-${ag}`}>
                    {ag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="text-sm font-medium px-4 py-3 rounded-lg border"
              style={{ background: 'var(--fg-red-pale)', color: 'var(--fg-red)', borderColor: 'rgba(192,57,43,.2)' }}>{error}</div>
          )}

          {/* Continue */}
          {selectedClub && (selectedCoach || addingNew) && (
            <button onClick={handleContinue} disabled={creating}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: 'var(--fg-green)', boxShadow: '0 4px 16px rgba(26,110,56,.25)' }}
              data-testid="continue-review">
              {creating ? 'Creating Coach...' : addingNew ? 'Create Coach & Write Review' : 'Continue to Review →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
