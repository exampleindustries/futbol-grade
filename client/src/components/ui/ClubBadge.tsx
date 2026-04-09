// Club logo badge — shows abbreviated club name as the coach avatar
// Uses a consistent color derived from the club name

const COLORS = [
  { bg: '#1a3c24', text: '#4ade80' },
  { bg: '#1e3a5f', text: '#60a5fa' },
  { bg: '#3b1a45', text: '#c084fc' },
  { bg: '#4a2315', text: '#fb923c' },
  { bg: '#14423a', text: '#2dd4bf' },
  { bg: '#3d1a1a', text: '#f87171' },
  { bg: '#2d3a1a', text: '#a3e635' },
  { bg: '#1a2e3d', text: '#38bdf8' },
]

function hashName(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0
  return Math.abs(h)
}

function abbreviate(name: string) {
  // "Empire Surf Soccer" → "ESS", "City SC Southwest" → "CSC"
  const words = name.replace(/\b(FC|SC|USA|SW|SDSC)\b/gi, '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase()
  return words.map(w => w[0]).join('').slice(0, 4).toUpperCase()
}

export function ClubBadge({ clubName, size = 'md' }: { clubName?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const name = clubName || 'Club'
  const color = COLORS[hashName(name) % COLORS.length]
  const abbr = abbreviate(name)

  const sizes = {
    sm: 'w-8 h-8 text-[9px]',
    md: 'w-12 h-12 text-[11px]',
    lg: 'w-14 h-14 text-sm',
  }

  return (
    <div
      className={`${sizes[size]} rounded-xl flex items-center justify-center font-bebas tracking-wide flex-shrink-0`}
      style={{ background: color.bg, color: color.text }}
    >
      {abbr}
    </div>
  )
}
