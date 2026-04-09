import { Nav } from '@/components/layout/Nav'

export default function NotFound() {
  return (
    <div style={{ background: 'var(--fg-bg)', minHeight: '100vh' }}>
      <Nav />
      <div className="max-w-lg mx-auto px-6 py-20 text-center">
        <div className="text-5xl mb-4">⚽</div>
        <h1 className="font-bebas text-4xl tracking-[3px] mb-2" style={{ color: 'var(--fg-text)' }}>404</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--fg-muted)' }}>This page doesn't exist. Maybe it was offside.</p>
        <a href="/#/" className="px-6 py-3 rounded-xl text-sm font-semibold text-white inline-block" style={{ background: 'var(--fg-green)' }} data-testid="back-home">
          Back to Home
        </a>
      </div>
    </div>
  )
}
