import { weekdayFromIso } from './data'
import {
  distanceKm,
  distanceScore,
  travelLabel,
} from './constants'
import {
  anyRangeOverlap,
  applyBookedHours,
  dayHoursFromSlots,
  emptyDayHours,
  formatDayHours,
  isDayOpen,
  jobRange,
  rangeFromSlots,
  isPastDate,
} from './time'
import type { DayHours, Job, Seeker, Slot, TimeRange, WorkRequest, Workplace } from './types'

export function plannedHoursOnDate(seeker: Seeker, date: string): DayHours {
  if (seeker.blocked.includes(date)) return emptyDayHours()
  if (seeker.hours && Object.prototype.hasOwnProperty.call(seeker.hours, date)) {
    return seeker.hours[date]
  }
  if (Object.prototype.hasOwnProperty.call(seeker.overrides, date)) {
    return dayHoursFromSlots(seeker.overrides[date])
  }
  return dayHoursFromSlots(seeker.recurring[weekdayFromIso(date)] ?? [])
}

export function requestTimeRange(req: Pick<WorkRequest, 'slots' | 'startTime' | 'endTime'>): TimeRange {
  if (req.startTime && req.endTime) return { start: req.startTime, end: req.endTime }
  return rangeFromSlots(req.slots ?? [])
}

export function bookedRangesForSeeker(
  requests: WorkRequest[],
  seekerId: string,
): Record<string, TimeRange[]> {
  const out: Record<string, TimeRange[]> = {}
  for (const r of requests) {
    if (r.seekerId !== seekerId || r.status !== 'accepted') continue
    ;(out[r.date] ??= []).push(requestTimeRange(r))
  }
  return out
}

export function bookedBySeekerOnDate(
  requests: WorkRequest[],
  date: string,
): Record<string, TimeRange[]> {
  const out: Record<string, TimeRange[]> = {}
  for (const r of requests) {
    if (r.status !== 'accepted' || r.date !== date) continue
    ;(out[r.seekerId] ??= []).push(requestTimeRange(r))
  }
  return out
}

export function hoursOnDate(seeker: Seeker, date: string, booked: TimeRange[] = []): DayHours {
  return applyBookedHours(plannedHoursOnDate(seeker, date), booked)
}

export function slotsOnDate(seeker: Seeker, date: string, booked: TimeRange[] = []): Slot[] {
  const hours = hoursOnDate(seeker, date, booked)
  if (hours.flexible) return ['flexibel']
  const slots: Slot[] = []
  for (const r of hours.ranges) {
    if (r.start <= '06:00' && r.end >= '12:00') slots.push('ochtend')
    else if (r.start < '12:00' && r.end > '06:00') slots.push('ochtend')
    if (r.start < '18:00' && r.end > '12:00') slots.push('namiddag')
    if (r.start < '24:00' && r.end > '18:00') slots.push('avond')
  }
  return [...new Set(slots)]
}

export function slotsOverlap(available: Slot[], needed: Slot[]): boolean {
  if (available.length === 0 || needed.length === 0) return false
  if (available.includes('flexibel') || needed.includes('flexibel')) return true
  return needed.some((s) => available.includes(s))
}

export function skillOverlap(seeker: Seeker, skills: string[]): number {
  if (skills.length === 0) return 0
  const set = new Set(seeker.skills)
  const hits = skills.filter((s) => set.has(s)).length
  return hits / skills.length
}

export function cityScore(seekerCity: string, jobCity: string): number {
  if (seekerCity === jobCity) return 1
  const neighbours: Record<string, string[]> = {
    Gent: ['Aalst', 'Brugge', 'Kortrijk'],
    Antwerpen: ['Mechelen', 'Brussel'],
    Brussel: ['Leuven', 'Mechelen', 'Antwerpen'],
    Leuven: ['Brussel', 'Mechelen', 'Hasselt'],
    Brugge: ['Oostende', 'Gent', 'Kortrijk'],
    Mechelen: ['Antwerpen', 'Leuven', 'Brussel'],
    Hasselt: ['Leuven'],
    Kortrijk: ['Gent', 'Brugge', 'Aalst'],
    Oostende: ['Brugge'],
    Aalst: ['Gent', 'Brussel', 'Kortrijk'],
  }
  return neighbours[jobCity]?.includes(seekerCity) ? 0.55 : 0.2
}

export type MatchOpts = {
  date: string
  slots: Slot[]
  startTime?: string
  endTime?: string
  skills: string[]
  city: string
  urgent?: boolean
  workplace?: Workplace | null
  hourlyRate?: number
  requiresLicense?: boolean
  booked?: TimeRange[]
  bookedBySeeker?: Record<string, TimeRange[]>
}

export type MatchResult = {
  seeker: Seeker
  score: number
  available: Slot[]
  hours: DayHours
  reasons: string[]
  distanceKm: number
  travel: string
}

export type JobMatch = Job & {
  score: number
  reasons: string[]
  distanceKm: number
  travel: string
  fit: boolean
}

function missReasons(seeker: Seeker, opts: MatchOpts): string[] {
  const booked = opts.booked ?? opts.bookedBySeeker?.[seeker.id] ?? []
  const hours = hoursOnDate(seeker, opts.date, booked)
  const reasons: string[] = []
  const needsLicense = opts.requiresLicense || opts.skills.includes('Chauffeur')
  if (needsLicense && !seeker.hasLicense) reasons.push('Rijbewijs nodig')
  if (opts.hourlyRate != null && opts.hourlyRate < seeker.hourlyRateMin) {
    reasons.push(`Jouw minimum is €${seeker.hourlyRateMin}/u`)
  }
  if (!isDayOpen(hours)) reasons.push('Die dag sta je niet vrij')
  else {
    const needed = jobRange({
      slots: opts.slots,
      startTime: opts.startTime ?? '',
      endTime: opts.endTime ?? '',
    })
    const neededFlexible = opts.slots.includes('flexibel')
    if (!hours.flexible && !neededFlexible && !anyRangeOverlap(hours.ranges, [needed])) {
      reasons.push(`Jouw uren: ${formatDayHours(hours)}`)
    }
  }
  const km = distanceKm(seeker.city, {
    city: opts.workplace?.city ?? opts.city,
    lat: opts.workplace?.lat,
    lng: opts.workplace?.lng,
  })
  const maxKm = seeker.hasTransport ? 90 : 28
  if (km > maxKm) reasons.push(seeker.hasTransport ? `${Math.round(km)} km verder` : 'Te ver zonder auto')
  if (reasons.length === 0) reasons.push('Past niet 100%')
  return reasons
}

export function jobsForSeeker(
  seeker: Seeker,
  jobs: Job[],
  bookedByDate: Record<string, TimeRange[]> = {},
): JobMatch[] {
  return jobs
    .filter((j) => j.status === 'open' && !isPastDate(j.date))
    .map((j) => {
      const opts: MatchOpts = {
        date: j.date,
        slots: j.slots,
        startTime: j.startTime,
        endTime: j.endTime,
        skills: j.skills,
        city: j.city,
        urgent: j.urgent,
        workplace: j.workplace,
        hourlyRate: j.hourlyRate,
        requiresLicense: j.requiresLicense,
        booked: bookedByDate[j.date] ?? [],
      }
      const m = scoreSeeker(seeker, opts)
      if (m) {
        return { ...j, score: m.score, reasons: m.reasons, distanceKm: m.distanceKm, travel: m.travel, fit: true }
      }
      const km = distanceKm(seeker.city, {
        city: j.workplace?.city ?? j.city,
        lat: j.workplace?.lat,
        lng: j.workplace?.lng,
      })
      return {
        ...j,
        score: 0,
        reasons: missReasons(seeker, opts),
        distanceKm: km,
        travel: travelLabel(km, seeker.hasTransport),
        fit: false,
      }
    })
    .sort((a, b) => {
      if (a.fit !== b.fit) return a.fit ? -1 : 1
      if (a.urgent !== b.urgent) return a.urgent ? -1 : 1
      if (a.fit && b.fit) return b.score - a.score
      return a.date.localeCompare(b.date)
    })
}

export function scoreSeeker(seeker: Seeker, opts: MatchOpts): MatchResult | null {
  const booked = opts.booked ?? opts.bookedBySeeker?.[seeker.id] ?? []
  const hours = hoursOnDate(seeker, opts.date, booked)
  if (!isDayOpen(hours)) return null

  const needsLicense = opts.requiresLicense || opts.skills.includes('Chauffeur')
  if (needsLicense && !seeker.hasLicense) return null

  if (opts.hourlyRate != null && opts.hourlyRate < seeker.hourlyRateMin) return null

  const needed = jobRange({
    slots: opts.slots,
    startTime: opts.startTime ?? '',
    endTime: opts.endTime ?? '',
  })
  const neededFlexible = opts.slots.includes('flexibel')
  if (!hours.flexible && !neededFlexible && !anyRangeOverlap(hours.ranges, [needed])) {
    return null
  }

  const km = distanceKm(seeker.city, {
    city: opts.workplace?.city ?? opts.city,
    lat: opts.workplace?.lat,
    lng: opts.workplace?.lng,
  })
  const maxKm = seeker.hasTransport ? 90 : 28
  if (km > maxKm) return null

  const skills = skillOverlap(seeker, opts.skills)
  const dist = distanceScore(km)
  const lastMinute = opts.urgent && seeker.lastMinute ? 1 : seeker.lastMinute ? 0.4 : 0
  const score = Math.round((skills * 42 + dist * 30 + 16 + lastMinute * 12) * 10) / 10

  const travel = travelLabel(km, seeker.hasTransport)
  const reasons: string[] = []
  reasons.push(hours.flexible ? 'Flexibel die dag' : `Vrij ${formatDayHours(hours)}`)
  if (skills >= 1) reasons.push('Alle skills')
  else if (skills >= 0.5) reasons.push('Skills komen overeen')
  reasons.push(travel)
  if (opts.urgent && seeker.lastMinute) reasons.push('Last-minute klaar')
  if (seeker.hasTransport) reasons.push('Eigen vervoer')
  if (needsLicense && seeker.hasLicense) reasons.push('Rijbewijs B')

  return {
    seeker,
    score: Math.min(99, Math.max(42, score)),
    available: slotsOnDate(seeker, opts.date, booked),
    hours,
    reasons,
    distanceKm: km,
    travel,
  }
}

export function rankSeekers(seekers: Seeker[], opts: MatchOpts): MatchResult[] {
  return seekers
    .map((s) => scoreSeeker(s, opts))
    .filter((m): m is MatchResult => m !== null)
    .sort((a, b) => b.score - a.score)
}
