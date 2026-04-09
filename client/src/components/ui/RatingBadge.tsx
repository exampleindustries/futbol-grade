import { getRatingColor, getGradeLabel, formatScore } from '@/lib/fg-utils'
import { cn } from '@/lib/utils'

interface RatingBadgeProps {
  score: number
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showGrade?: boolean
  className?: string
}

export function RatingBadge({ score, size = 'md', showGrade = false, className }: RatingBadgeProps) {
  const color = getRatingColor(score)
  const grade = getGradeLabel(score)
  const textSizes = { sm: 'text-lg', md: 'text-2xl', lg: 'text-4xl', xl: 'text-6xl' }
  const starSizes = { sm: 'text-xs', md: 'text-sm', lg: 'text-xl', xl: 'text-3xl' }

  return (
    <div className={cn('flex flex-col items-end', className)} data-testid="rating-badge">
      <div className={cn('font-bebas tracking-wide flex items-center gap-1', textSizes[size])} style={{ color }}>
        <span className={starSizes[size]}>⭐</span>
        {formatScore(score)}
      </div>
      {showGrade && (
        <span
          className="font-mono text-[10px] font-bold tracking-widest px-2 py-0.5 rounded mt-1 border"
          style={{ color, background: `${color}18`, borderColor: `${color}33` }}
        >
          {grade}
        </span>
      )}
    </div>
  )
}
