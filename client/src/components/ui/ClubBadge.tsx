// Club logo badge — shows abbreviated club name as the coach avatar
// Uses a consistent color derived from the club name

// Club-specific colors (uniform/logo colors)
const CLUB_COLORS: Record<string, { bg: string; text: string }> = {
  'City SC Southwest': { bg: '#0a1a3a', text: '#f97316' },        // Navy + Orange
  'Legends FC': { bg: '#1a1a1a', text: '#eab308' },               // Black + Gold
  'Empire Surf Soccer': { bg: '#1e40af', text: '#ffffff' },       // Blue + White
  'San Diego Surf Soccer': { bg: '#1e3a8a', text: '#ffffff' },    // Blue + White
  'Rebels Soccer Club': { bg: '#1e3a5f', text: '#60a5fa' },       // Navy + Light Blue
  'Sporting California USA SW': { bg: '#1a3c24', text: '#4ade80' }, // Green + Lime
  'Murrieta Surf SC': { bg: '#1e40af', text: '#ffffff' },         // Blue + White
  'SDSC Escondido Surf': { bg: '#1e3a8a', text: '#ffffff' },      // Blue + White
  'Pateadores': { bg: '#7f1d1d', text: '#fbbf24' },               // Maroon + Gold
  'LAFC Youth Academy': { bg: '#1a1a1a', text: '#c9b037' },       // Black + Gold
  'Lake SC': { bg: '#0e4a2e', text: '#34d399' },                  // Green + Mint
  'SoCal Elite FC': { bg: '#1a1a1a', text: '#ef4444' },           // Black + Red
  'Magnus FC': { bg: '#312e81', text: '#ffffff' },                // Indigo + White
  'FC Riverside County': { bg: '#1a1a1a', text: '#f97316' },      // Black + Orange
  'West Coast FC': { bg: '#0c4a6e', text: '#ffffff' },            // Dark Blue + White
}

// Fallback colors for clubs not in the map
const FALLBACK_COLORS = [
  { bg: '#1a3c24', text: '#4ade80' },
  { bg: '#1e3a5f', text: '#60a5fa' },
  { bg: '#3b1a45', text: '#c084fc' },
  { bg: '#4a2315', text: '#fb923c' },
  { bg: '#14423a', text: '#2dd4bf' },
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

export function ClubBadge({ clubName, logoUrl, size = 'md' }: { clubName?: string | null; logoUrl?: string | null; size?: 'xs' | 'sm' | 'md' | 'lg' }) {
  const name = clubName || 'Club'
  const color = CLUB_COLORS[name] || FALLBACK_COLORS[hashName(name) % FALLBACK_COLORS.length]
  const abbr = abbreviate(name)

  const sizes = {
    xs: 'w-6 h-6 text-[7px]',
    sm: 'w-8 h-8 text-[9px]',
    md: 'w-12 h-12 text-[11px]',
    lg: 'w-14 h-14 text-sm',
  }

  if (logoUrl) {
    return (
      <img src={logoUrl} alt={name}
        className={`${sizes[size]} rounded-xl object-contain flex-shrink-0 border`}
        style={{ borderColor: 'rgba(0,0,0,0.08)' }} />
    )
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
