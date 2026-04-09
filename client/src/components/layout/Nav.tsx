import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'

export function Nav() {
  const { user, profile, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav
      className="sticky top-0 z-50 backdrop-blur-md border-b"
      style={{
        background: 'rgba(255,255,255,0.93)',
        borderColor: 'var(--fg-border)',
        boxShadow: '0 1px 0 var(--fg-border), 0 2px 12px rgba(0,0,0,0.04)',
      }}
      data-testid="main-nav"
    >
      <div className="max-w-6xl mx-auto px-6 h-[62px] flex items-center justify-between gap-4">
        {/* Logo */}
        <a href="#/" className="flex items-center gap-2 font-bebas text-[26px] tracking-[3px]" style={{ color: 'var(--fg-text)' }} data-testid="logo-link">
          <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: 'var(--fg-green-light)', boxShadow: '0 0 8px rgba(46,170,80,0.6)' }} />
          FUTBOL<span style={{ color: 'var(--fg-green-light)' }}>GRADE</span>
        </a>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6 text-sm font-medium" style={{ color: 'var(--fg-text2)' }}>
          <a href="#/coaches" className="hover:opacity-70 transition-opacity" data-testid="nav-coaches">Coaches</a>
          <a href="#/clubs" className="hover:opacity-70 transition-opacity" data-testid="nav-clubs">Clubs</a>
          <a href="#/marketplace" className="hover:opacity-70 transition-opacity" data-testid="nav-marketplace">Marketplace</a>
        </div>

        {/* Auth + Mobile toggle */}
        <div className="flex items-center gap-2">
          {user ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all"
                style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-text2)' }}
                data-testid="user-menu-btn"
              >
                <span>⚽</span>
                <span className="hidden sm:block">{profile?.alias || 'My Account'}</span>
                <span className="text-xs">▾</span>
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 top-full mt-1 w-44 bg-white border rounded-xl shadow-lg overflow-hidden z-50"
                  style={{ borderColor: 'var(--fg-border)' }}
                >
                  <a href="#/profile" className="block px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors" style={{ color: 'var(--fg-text)' }} data-testid="menu-profile">
                    My Profile
                  </a>
                  <div className="border-t" style={{ borderColor: 'var(--fg-border)' }} />
                  <button
                    onClick={() => { signOut(); setMenuOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-gray-50"
                    style={{ color: 'var(--fg-red)' }}
                    data-testid="menu-signout"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <a
                href="#/auth/login"
                className="px-4 py-2 rounded-lg border text-sm font-medium transition-all hidden sm:block"
                style={{ borderColor: 'var(--fg-border2)', color: 'var(--fg-text2)' }}
                data-testid="nav-login"
              >
                Log In
              </a>
              <a
                href="#/auth/register"
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all"
                style={{ background: 'var(--fg-green)', boxShadow: '0 2px 10px rgba(26,110,56,.25)' }}
                data-testid="nav-signup"
              >
                Sign Up
              </a>
            </>
          )}

          {/* Mobile hamburger */}
          <button
            className="md:hidden ml-1 p-2 rounded-lg border"
            style={{ borderColor: 'var(--fg-border2)' }}
            onClick={() => setMobileOpen(!mobileOpen)}
            data-testid="mobile-menu-btn"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t px-6 py-4 space-y-1" style={{ borderColor: 'var(--fg-border)', background: 'var(--fg-surface)' }}>
          <a href="#/coaches" className="block text-sm font-medium py-2.5" style={{ color: 'var(--fg-text2)' }}>Coaches</a>
          <a href="#/clubs" className="block text-sm font-medium py-2.5" style={{ color: 'var(--fg-text2)' }}>Clubs</a>
          <a href="#/marketplace" className="block text-sm font-medium py-2.5" style={{ color: 'var(--fg-text2)' }}>Marketplace</a>
          {!user && (
            <>
              <div className="border-t my-2" style={{ borderColor: 'var(--fg-border)' }} />
              <a href="#/auth/login" className="block text-sm font-medium py-2.5" style={{ color: 'var(--fg-text2)' }}>Log In</a>
            </>
          )}
        </div>
      )}
    </nav>
  )
}
