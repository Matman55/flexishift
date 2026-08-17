import { SLOT_RANGE, isPastDate, toMinutes } from './time'
import type { Job, WorkRequest } from './types'

export function shiftHours(r: Pick<WorkRequest, 'startTime' | 'endTime' | 'slots'>): number {
  if (r.startTime && r.endTime) {
    const mins = toMinutes(r.endTime) - toMinutes(r.startTime)
    return Math.round((Math.max(0, mins) / 60) * 100) / 100
  }
  let mins = 0
  for (const s of r.slots) {
    if (s === 'flexibel') mins += 8 * 60
    else {
      const range = SLOT_RANGE[s]
      mins += toMinutes(range.end) - toMinutes(range.start)
    }
  }
  return Math.round((mins / 60) * 100) / 100
}

export function shiftRate(r: WorkRequest, jobs: Job[], fallback: number): number {
  if (r.hourlyRate != null) return r.hourlyRate
  if (r.jobId) {
    const job = jobs.find((j) => j.id === r.jobId)
    if (job) return job.hourlyRate
  }
  return fallback
}

export function shiftPay(r: WorkRequest, jobs: Job[], fallback: number): number {
  return Math.round(shiftHours(r) * shiftRate(r, jobs, fallback) * 100) / 100
}

export function isCompletedShift(r: WorkRequest): boolean {
  return r.status === 'accepted' && isPastDate(r.date)
}

export function completedShifts(requests: WorkRequest[], seekerId: string): WorkRequest[] {
  return requests
    .filter((r) => r.seekerId === seekerId && isCompletedShift(r))
    .sort((a, b) => `${b.date}${b.startTime ?? ''}`.localeCompare(`${a.date}${a.startTime ?? ''}`))
}

export type WorkedTogether = {
  seekerId: string
  last: WorkRequest
  count: number
}

export function peopleWhoWorkedFor(requests: WorkRequest[], employerId: string): WorkedTogether[] {
  const done = requests
    .filter((r) => r.employerId === employerId && isCompletedShift(r))
    .sort((a, b) => `${b.date}${b.startTime ?? ''}`.localeCompare(`${a.date}${a.startTime ?? ''}`))
  const map = new Map<string, WorkedTogether>()
  for (const r of done) {
    const cur = map.get(r.seekerId)
    if (cur) cur.count += 1
    else map.set(r.seekerId, { seekerId: r.seekerId, last: r, count: 1 })
  }
  return [...map.values()]
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('nl-BE', { month: 'long', year: 'numeric' })
}

export function currentMonthKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export type MonthBucket = {
  key: string
  label: string
  pay: number
  hours: number
  count: number
  shifts: WorkRequest[]
}

export function earningsByMonth(shifts: WorkRequest[], jobs: Job[], fallback: number): MonthBucket[] {
  const map = new Map<string, MonthBucket>()
  for (const s of shifts) {
    const key = monthKey(s.date)
    const cur = map.get(key) ?? {
      key,
      label: monthLabel(key),
      pay: 0,
      hours: 0,
      count: 0,
      shifts: [],
    }
    cur.pay += shiftPay(s, jobs, fallback)
    cur.hours += shiftHours(s)
    cur.count += 1
    cur.shifts.push(s)
    map.set(key, cur)
  }
  return [...map.values()]
    .sort((a, b) => b.key.localeCompare(a.key))
    .map((b) => ({
      ...b,
      pay: Math.round(b.pay * 100) / 100,
      hours: Math.round(b.hours * 100) / 100,
    }))
}

export function hoursCsv(
  shifts: WorkRequest[],
  jobs: Job[],
  fallback: number,
  companyOf: (r: WorkRequest) => string,
): string {
  const rows = [
    ['Datum', 'Titel', 'Zaak', 'Van', 'Tot', 'Uren', 'Tarief', 'Loon'].join(','),
    ...shifts.map((r) => {
      const hours = shiftHours(r)
      const rate = shiftRate(r, jobs, fallback)
      const pay = shiftPay(r, jobs, fallback)
      const cells = [
        r.date,
        r.title,
        companyOf(r),
        r.startTime ?? '',
        r.endTime ?? '',
        String(hours).replace('.', ','),
        String(rate),
        String(pay).replace('.', ','),
      ]
      return cells.map((c) => `"${c.replaceAll('"', '""')}"`).join(',')
    }),
  ]
  return rows.join('\n')
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function datesInWeek(from = new Date()): string[] {
  const d = new Date(from)
  d.setHours(12, 0, 0, 0)
  const mondayOffset = d.getDay() === 0 ? -6 : 1 - d.getDay()
  d.setDate(d.getDate() + mondayOffset)
  return Array.from({ length: 7 }, (_, i) => {
    const n = new Date(d)
    n.setDate(d.getDate() + i)
    const y = n.getFullYear()
    const m = String(n.getMonth() + 1).padStart(2, '0')
    const day = String(n.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  })
}
