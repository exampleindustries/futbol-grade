import { getRatingColor } from '@/lib/fg-utils'
import { KPI_LABELS } from '@/lib/types'

interface KpiBarProps {
  label?: string
  kpiKey?: string
  score: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  showValue?: boolean
}

export function KpiBar({ label, kpiKey, score, size = 'md', showLabel = true, showValue = true }: KpiBarProps) {
  const displayLabel = label ?? (kpiKey ? (KPI_LABELS[kpiKey] || KPI_LABELS[kpiKey.replace('avg_', 'score_')] || kpiKey) : '')
  const color = getRatingColor(score)
  const width = `${(score / 5) * 100}%`
  const heights: Record<string, string> = { sm: '4px', md: '8px', lg: '10px' }
  const labelSizes: Record<string, string> = { sm: 'text-[10px]', md: 'text-xs', lg: 'text-sm' }

  return (
    <div className="flex items-center gap-3" data-testid={`kpi-bar-${kpiKey || 'custom'}`}>
      {showLabel && (
        <span className={`font-mono ${labelSizes[size]} flex-shrink-0 w-32 font-medium`} style={{ color: 'var(--fg-muted)' }}>
          {displayLabel}
        </span>
      )}
      <div className="flex-1 rounded-full overflow-hidden" style={{ height: heights[size], background: 'var(--fg-border)' }}>
        <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width, background: color }} />
      </div>
      {showValue && (
        <span className={`font-bebas ${size === 'lg' ? 'text-xl' : 'text-base'} w-9 text-right tracking-wide`} style={{ color }}>
          {score.toFixed(1)}
        </span>
      )}
    </div>
  )
}
