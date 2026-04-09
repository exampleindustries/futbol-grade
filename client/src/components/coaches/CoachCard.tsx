import { getRatingColor, getBarWidth, initials } from '@/lib/fg-utils'
import { KPI_AVG_KEYS, KPI_LABELS, type Coach } from '@/lib/types'
import { RatingBadge } from '@/components/ui/RatingBadge'

const CARD_KPIS = KPI_AVG_KEYS.slice(0, 3)

export function CoachCard({ coach }: { coach: Coach }) {
  const overall = coach.avg_overall
  const color = getRatingColor(overall)

  return (
    <a href={`#/coaches/${coach.id}`} className="block" data-testid={`coach-card-${coach.id}`}>
      <div
        className="bg-white border rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:-translate-y-1 relative overflow-hidden shadow-card hover:shadow-card-hover"
        style={{ borderColor: 'var(--fg-border)' }}
      >
        <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl" style={{ background: color }} />

        <div className="flex items-start gap-3 mb-4 mt-1">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center font-bebas text-xl flex-shrink-0 border-[1.5px]"
            style={{ background: 'var(--fg-green-pale)', color: 'var(--fg-green)', borderColor: 'var(--fg-border)' }}
          >
            {initials(coach.first_name, coach.last_name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[15px] truncate" style={{ color: 'var(--fg-text)' }}>
              {coach.first_name} {coach.last_name}
            </div>
            <div className="text-xs font-mono mt-0.5" style={{ color: 'var(--fg-muted)' }}>
              {coach.city || 'SoCal'}
            </div>
          </div>
          <RatingBadge score={overall} size="md" />
        </div>

        <div className="space-y-[6px] mb-4">
          {CARD_KPIS.map(key => {
            const score = (coach as any)[key] as number
            const label = (KPI_LABELS[key.replace('avg_', 'score_')] || key).split(' ')[0]
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="font-mono text-[10px] w-20 flex-shrink-0 font-medium" style={{ color: 'var(--fg-muted)' }}>
                  {label}
                </span>
                <div className="flex-1 h-[5px] rounded-full overflow-hidden" style={{ background: 'var(--fg-border)' }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: getBarWidth(score), background: getRatingColor(score) }} />
                </div>
                <span className="font-mono text-[10px] w-6 text-right font-medium" style={{ color: 'var(--fg-muted)' }}>
                  {score.toFixed(1)}
                </span>
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--fg-border)' }}>
          {coach.age_groups?.length > 0 && (
            <span
              className="font-mono text-[11px] px-2.5 py-0.5 rounded-md border font-semibold"
              style={{ background: 'var(--fg-green-pale)', color: 'var(--fg-green)', borderColor: 'rgba(26,110,56,.2)' }}
            >
              {coach.age_groups.join(' · ')}
            </span>
          )}
          <span className="font-mono text-[11px]" style={{ color: 'var(--fg-muted)' }}>
            {coach.total_reviews} review{coach.total_reviews !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </a>
  )
}
