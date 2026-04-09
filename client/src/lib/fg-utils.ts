// Rating & formatting utilities for Futbol Grade

const MLS_NAMES = [
  'Messi','Suárez','Cucho','Acosta','Pulisic','Weah','Reyna','McKennie','Adams',
  'Musah','Sargent','Dest','Lodeiro','Martínez','Vela','Giovinco','Villa','Bradley',
  'Dempsey','Donovan','Wondolowski','Zardes','Zusi','Busio','Aaronson','Roldan',
  'Morgan','Rapinoe','Lloyd','Press','Heath','Horan','Dunn','Ertz','Krieger',
  'Sauerbrunn','Naeher','Sonnett','Mewis','Pugh','Lavelle','Huerta','Kerr','Sinclair',
]
const ALIAS_EMOJIS = ['⚽','🥅','🏆','🥇','🎯','👟','🌟','🔥','⚡','🦅','🦁','🐆','🦊','🌊','🏅','🎽']

export function getRatingColor(score: number): string {
  if (score >= 4.0) return '#2eaa50'
  if (score >= 3.0) return '#82c341'
  if (score >= 2.0) return '#d4620a'
  return '#c0392b'
}

export function getGradeLabel(score: number): string {
  if (score >= 4.5) return 'ELITE'
  if (score >= 4.0) return 'GREAT'
  if (score >= 3.5) return 'GOOD'
  if (score >= 3.0) return 'FAIR'
  if (score >= 2.0) return 'POOR'
  return 'LOW'
}

export function getBarWidth(score: number): string {
  return `${(score / 5) * 100}%`
}

export function formatScore(score: number): string {
  return score.toFixed(1)
}

export function generateAlias(): { name: string; emoji: string } {
  const n = MLS_NAMES[Math.floor(Math.random() * MLS_NAMES.length)]
  const num = Math.floor(Math.random() * 30) + 1
  const emoji = ALIAS_EMOJIS[Math.floor(Math.random() * ALIAS_EMOJIS.length)]
  return { name: `${n}_${String(num).padStart(2, '0')}`, emoji }
}

export function formatPrice(cents: number | null, text: string): string {
  if (!cents) return text
  return `$${(cents / 100).toFixed(2)}`
}

export function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export function fullName(first: string | null, last: string | null): string {
  return [first, last].filter(Boolean).join(' ') || 'Unknown'
}

export function initials(first: string | null, last: string | null): string {
  return `${(first?.[0] || '').toUpperCase()}${(last?.[0] || '').toUpperCase()}`
}
