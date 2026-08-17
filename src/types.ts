export const SLOTS = ['ochtend', 'namiddag', 'avond', 'flexibel'] as const
export type Slot = (typeof SLOTS)[number]

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type Weekday = (typeof WEEKDAYS)[number]

export type Role = 'seeker' | 'employer'

export type ContractKind = 'flexi' | 'extra' | 'student'

export type Transport = 'fiets' | 'auto' | 'ov' | 'te voet'

export type ApplyExtras = {
  arriveBy: string
  transport: Transport
  question?: string
}

export type Recurring = Record<Weekday, Slot[]>

export type TimeRange = {
  start: string
  end: string
}

export type DayHours = {
  ranges: TimeRange[]
  flexible: boolean
}

export type Seeker = {
  id: string
  name: string
  city: string
  hue: number
  bio: string
  sectors: string[]
  skills: string[]
  languages: string[]
  hasLicense: boolean
  hasTransport: boolean
  yearsExperience: number
  hourlyRateMin: number
  lastMinute: boolean
  rating: number
  jobsDone: number
  recurring: Recurring
  hours: Record<string, DayHours>
  overrides: Record<string, Slot[]>
  blocked: string[]
  onboardingDone: boolean
}

export type Employer = {
  id: string
  company: string
  contact: string
  city: string
  sector: string
  hue: number
  onboardingDone: boolean
  favorites: string[]
  workplace?: Workplace
}

export type Workplace = {
  address: string
  postal: string
  city: string
  lat: number
  lng: number
  access?: string
  parking?: string
  contactOnSite?: string
  notes?: string
}

export type Job = {
  id: string
  employerId: string
  title: string
  company: string
  city: string
  date: string
  slots: Slot[]
  startTime: string
  endTime: string
  skills: string[]
  sector: string
  hourlyRate: number
  peopleNeeded: number
  urgent: boolean
  description: string
  status: 'open' | 'filled'
  workplace: Workplace
  contractKind: ContractKind
  requiresLicense?: boolean
}

export type RequestStatus = 'pending' | 'accepted' | 'declined'

export type WorkRequest = {
  id: string
  jobId: string | null
  employerId: string
  seekerId: string
  from: Role
  message: string
  status: RequestStatus
  createdAt: string
  date: string
  slots: Slot[]
  startTime?: string
  endTime?: string
  title: string
  city: string
  extras?: ApplyExtras
  readAt?: string
  hourlyRate?: number
}

export type Session = {
  role: Role
  seekerId: string
  employerId: string
}

export type AppState = {
  session: Session | null
  seekers: Seeker[]
  employers: Employer[]
  jobs: Job[]
  requests: WorkRequest[]
}
