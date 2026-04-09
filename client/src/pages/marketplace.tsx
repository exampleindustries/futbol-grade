import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Listing } from '@/lib/types'
import { Nav } from '@/components/layout/Nav'
import { formatPrice, timeAgo } from '@/lib/fg-utils'

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'cleats', label: 'Cleats' },
  { value: 'jersey', label: 'Jerseys' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'training', label: 'Training' },
]

export default function Marketplace() {
  const [listings, setListings] = useState<Listing[]>([])
  const [tab, setTab] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchListings(tab) }, [tab])

  async function fetchListings(type: string) {
    setLoading(true)
    let q = supabase.from('listings').select('*, seller:profiles(id, alias, alias_emoji, avatar_url)')
      .eq('status', 'active').order('featured', { ascending: false }).order('created_at', { ascending: false }).limit(30)
    if (type !== 'all') q = q.eq('type', type)
    const { data } = await q
    setListings((data as Listing[]) || [])
    setLoading(false)
  }

  return (
    <div style={{ background: 'var(--fg-bg)', minHeight: '100vh' }}>
      <Nav />
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-2">
          <span className="font-mono text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--fg-muted)' }}>Buy &amp; Sell</span>
          <h1 className="font-bebas text-3xl tracking-[2px]" style={{ color: 'var(--fg-text)' }}>MARKETPLACE</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.value} onClick={() => setTab(t.value)}
              className="font-mono text-xs font-semibold px-4 py-2 rounded-lg border transition-all whitespace-nowrap"
              style={tab === t.value
                ? { background: 'var(--fg-green)', color: 'white', borderColor: 'var(--fg-green)' }
                : { background: 'var(--fg-surface)', color: 'var(--fg-text2)', borderColor: 'var(--fg-border2)' }}
              data-testid={`tab-${t.value}`}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl p-5 animate-pulse border h-40" style={{ borderColor: 'var(--fg-border)' }} />)}
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">🛒</div>
            <div className="font-semibold" style={{ color: 'var(--fg-text2)' }}>No listings yet</div>
            <div className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>Check back soon for soccer gear and training services</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.map(listing => (
              <div key={listing.id} className="bg-white border rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-1 shadow-card hover:shadow-card-hover"
                style={{ borderColor: 'var(--fg-border)' }} data-testid={`listing-${listing.id}`}>
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[15px] truncate" style={{ color: 'var(--fg-text)' }}>{listing.title}</div>
                      <span className="font-mono text-[10px] font-bold tracking-widest uppercase mt-1 inline-block px-2 py-0.5 rounded border"
                        style={{ background: 'var(--fg-green-pale)', color: 'var(--fg-green)', borderColor: 'rgba(26,110,56,.2)' }}>
                        {listing.type}
                      </span>
                    </div>
                    <div className="font-bebas text-xl tracking-wide" style={{ color: 'var(--fg-green)' }}>
                      {formatPrice(listing.price_cents, listing.price_text || 'Free')}
                    </div>
                  </div>
                  {listing.description && (
                    <p className="text-sm line-clamp-2 mb-3" style={{ color: 'var(--fg-text2)' }}>{listing.description}</p>
                  )}
                  <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--fg-border)' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{listing.seller?.alias_emoji || '⚽'}</span>
                      <span className="font-mono text-[11px]" style={{ color: 'var(--fg-muted)' }}>{listing.seller?.alias || 'Seller'}</span>
                    </div>
                    <span className="font-mono text-[10px]" style={{ color: 'var(--fg-muted)' }}>
                      {listing.view_count} views · {timeAgo(listing.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
