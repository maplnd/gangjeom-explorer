export type Category = 'transport' | 'lodging' | 'food' | 'sight' | 'activity' | 'shopping' | 'etc'
export type TravelMode = 'WALKING' | 'DRIVING' | 'TRANSIT' | 'BICYCLING'

export interface Place {
  name: string
  address?: string
  lat: number
  lng: number
  placeId?: string
}

export interface Stop {
  id: string
  date: string // YYYY-MM-DD
  start: string // HH:MM
  end: string // HH:MM
  title: string
  place?: Place
  category: Category
  cost: number
  memo: string
  modeToNext: TravelMode
  done?: boolean
  paidBy?: string | null
}

export interface Expense {
  id: string
  date: string
  label: string
  category: Category
  amount: number
  paidBy?: string | null
}

export interface ChecklistItem {
  id: string
  text: string
  category: string
  done: boolean
  sort: number
}

export interface DayNote {
  id: string
  date: string
  mood: string
  body: string
}

export interface Trip {
  id: string
  title: string
  destination?: string
  startDate: string
  endDate: string
  budget: number
  currency: string
  stops: Stop[]
  expenses: Expense[]
  checklist: ChecklistItem[]
  notes: DayNote[]
  createdAt: number
  role?: Role
  ownerId?: string
  memberIds?: string[]
}

export type Role = 'owner' | 'editor' | 'viewer'
export const ROLES: Record<Role, string> = { owner: '소유자', editor: '편집자', viewer: '보기 전용' }

export interface Profile {
  id: string
  email: string
  display_name: string
  status: 'pending' | 'approved' | 'rejected'
  is_admin: boolean
  created_at: string
}

export interface Member {
  user_id: string
  role: Role
  profile?: Pick<Profile, 'id' | 'email' | 'display_name'>
}

export interface Leg {
  distanceM: number
  durationS: number
  source: 'google' | 'estimate'
}

export const CATEGORIES: Record<Category, { label: string; icon: string; color: string }> = {
  transport: { label: '교통', icon: '🚆', color: '#3b82f6' },
  lodging: { label: '숙소', icon: '🏨', color: '#8b5cf6' },
  food: { label: '식사', icon: '🍜', color: '#f97316' },
  sight: { label: '관광', icon: '🏞️', color: '#10b981' },
  activity: { label: '체험', icon: '🎟️', color: '#ec4899' },
  shopping: { label: '쇼핑', icon: '🛍️', color: '#eab308' },
  etc: { label: '기타', icon: '📌', color: '#64748b' },
}

export const MODES: Record<TravelMode, { label: string; icon: string; kmh: number }> = {
  WALKING: { label: '도보', icon: '🚶', kmh: 4.5 },
  TRANSIT: { label: '대중교통', icon: '🚌', kmh: 22 },
  DRIVING: { label: '자동차', icon: '🚗', kmh: 35 },
  BICYCLING: { label: '자전거', icon: '🚲', kmh: 14 },
}
