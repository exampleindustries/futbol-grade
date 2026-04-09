// Types matching the Supabase schema

export type Region = 'socal' | 'norcal' | 'texas' | 'florida' | 'midwest' | 'northeast' | 'northwest' | 'southeast' | 'mountain'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'
export type ListingStatus = 'pending' | 'active' | 'sold' | 'expired' | 'removed'
export type ListingType = 'cleats' | 'jersey' | 'equipment' | 'training' | 'other'

export interface Profile {
  id: string
  first_name: string | null
  last_name: string | null
  alias: string
  alias_emoji: string
  avatar_url: string | null
  prefer_anonymous: boolean
  role: string
  is_admin: boolean
  created_at: string
  updated_at: string
}

export interface Club {
  id: string
  name: string
  abbr: string | null
  logo_url: string | null
  website: string | null
  city: string | null
  state: string | null
  region: Region
  status: ApprovalStatus
  avg_overall: number
  avg_technical: number
  avg_team_building: number
  avg_development: number
  avg_approachability: number
  avg_professionalism: number
  avg_dedication: number
  coach_count: number
  total_reviews: number
  approved_by: string | null
  approved_at: string | null
  crawled_at: string | null
  created_at: string
  updated_at: string
}

export interface Coach {
  id: string
  first_name: string
  last_name: string
  club_id: string | null
  city: string | null
  state: string | null
  region: Region
  age_groups: string[]
  license: string | null
  email: string | null
  photo_url: string | null
  user_id: string | null
  status: ApprovalStatus
  avg_overall: number
  avg_technical: number
  avg_team_building: number
  avg_development: number
  avg_approachability: number
  avg_professionalism: number
  avg_dedication: number
  total_reviews: number
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
  // Joined
  club?: Pick<Club, 'id' | 'name' | 'logo_url'> | null
}

export type ClaimStatus = 'pending' | 'approved' | 'rejected'

export interface CoachClaim {
  id: string
  coach_id: string
  user_id: string
  email: string
  phone: string | null
  license_number: string | null
  verification_note: string | null
  status: ClaimStatus
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  // Joined
  coach?: Pick<Coach, 'id' | 'first_name' | 'last_name'> | null
  claimant?: Pick<Profile, 'alias' | 'alias_emoji'> | null
}

export interface Review {
  id: string
  coach_id: string
  reviewer_id: string
  is_anonymous: boolean
  display_name: string | null
  player_position: string | null
  years_with_coach: string | null
  score_technical: number
  score_team_building: number
  score_development: number
  score_approachability: number
  score_professionalism: number
  score_dedication: number
  pros: string[]
  cons: string[]
  body: string | null
  status: ApprovalStatus
  flagged_reason: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  // Joined
  reviewer?: Pick<Profile, 'alias' | 'alias_emoji' | 'prefer_anonymous' | 'first_name' | 'last_name'> | null
}

export interface Listing {
  id: string
  seller_id: string
  type: ListingType
  title: string
  description: string | null
  price_cents: number | null
  price_text: string | null
  image_urls: string[]
  status: ListingStatus
  featured: boolean
  approved_by: string | null
  approved_at: string | null
  view_count: number
  created_at: string
  updated_at: string
  expires_at: string | null
  // Joined
  seller?: Pick<Profile, 'id' | 'alias' | 'alias_emoji' | 'avatar_url'> | null
}

// KPI keys for iteration
export const KPI_SCORE_KEYS = [
  'score_technical',
  'score_team_building',
  'score_development',
  'score_approachability',
  'score_professionalism',
  'score_dedication',
] as const

export const KPI_AVG_KEYS = [
  'avg_technical',
  'avg_team_building',
  'avg_development',
  'avg_approachability',
  'avg_professionalism',
  'avg_dedication',
] as const

export type KpiScoreKey = typeof KPI_SCORE_KEYS[number]
export type KpiAvgKey = typeof KPI_AVG_KEYS[number]

export const KPI_LABELS: Record<string, string> = {
  score_technical: 'Technical Skills',
  score_team_building: 'Team Building',
  score_development: 'Player Development',
  score_approachability: 'Approachability',
  score_professionalism: 'Professionalism',
  score_dedication: 'Dedication',
  avg_technical: 'Technical Skills',
  avg_team_building: 'Team Building',
  avg_development: 'Player Development',
  avg_approachability: 'Approachability',
  avg_professionalism: 'Professionalism',
  avg_dedication: 'Dedication',
}
