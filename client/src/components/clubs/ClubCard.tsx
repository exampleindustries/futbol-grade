import { getRatingColor, getGradeLabel, getBarWidth } from '@/lib/fg-utils'
import { KPI_AVG_KEYS, KPI_LABELS, type Club } from '@/lib/types'
import { RatingBadge } from '@/components/ui/RatingBadge'

const CARD_KPIS = KPI_AVG_KEYS.slice(0, 3)

export function ClubCard({ club }: { club: Club }) {
  const overall = club.avg_overall
  const color = getRatingColor(overall)
  const grade = getGradeLabel(overall)

  const gradePillStyle = overall >= 4
    ? { color: 'var(--fg-green)', background: 'var(--fg-green-pale)', borderColor: 'rgba(26,110,56,.2)' }
    : overall >= 3
    ? { color: '#7a6010', background: '#fefae8', borderColor: 'rgba(183,119,13,.2)' }
    : { color: 'var(--fg-red)', background: 'var(--fg-red-pale)', borderColor: 'rgba(192,57,43,.2)' }

  return (
    <a href={`#/clubs/${club.id}`} className="block" data-testid={`club-card-${club.id}`}>
      <div
        className="bg-white border rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-1 shadow-card hover:shadow-card-hover"
        style={{ borderColor: 'var(--fg-border)' }}
      >
        <div className="h-[6px]" style={{ background: color }} />
        <div className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center font-bebas text-lg flex-shrink-0 border-[1.5px] overflow-hidden"
              style={{ borderColor: 'var(--fg-border)', background: 'var(--fg-green-pale)', color: 'var(--fg-green)' }}
            >
              {club.abbr || club.name.slice(0, 3).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[15px] truncate" style={{ color: 'var(--fg-text)' }}>{club.name}</div>
              <div className="text-[11px] font-mono mt-1" style={{ color: 'var(--fg-muted)' }}>📍 {club.city || 'SoCal'}</div>
            </div>
            <RatingBadge score={overall} size="md" />
          </div>

          <div className="space-y-[6px] mb-4">
            {CARD_KPIS.map(key => {
              const score = (club as any)[key] as number
              const label = (KPI_LABELS[key.replace('avg_', 'score_')] || key).split(' ')[0]
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="font-mono text-[10px] w-20 flex-shrink-0 font-medium" style={{ color: 'var(--fg-muted)' }}>{label}</span>
                  <div className="flex-1 h-[4px] rounded-full overflow-hidden" style={{ background: 'var(--fg-border)' }}>
                    <div className="h-full rounded-full" style={{ width: getBarWidth(score), background: getRatingColor(score) }} />
                  </div>
                  <span className="font-mono text-[10px] w-6 text-right font-medium" style={{ color: 'var(--fg-muted)' }}>{score.toFixed(1)}</span>
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--fg-border)' }}>
            <span className="font-mono text-[11px]" style={{ color: 'var(--fg-muted)' }}>
              {club.coach_count} coaches · {club.total_reviews} reviews
            </span>
            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded border" style={gradePillStyle}>{grade}</span>
          </div>
        </div>
      </div>
    </a>
  )
}
