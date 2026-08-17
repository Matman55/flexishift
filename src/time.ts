import type { DayHours, Job, Slot, TimeRange } from './types'

export const SLOT_RANGE: Record<Exclude<Slot, 'flexibel'>, TimeRange> = {
  ochtend: { start: '06:00', end: '12:00' },
  namiddag: { start: '12:00', end: '18:00' },
  avond: { start: '18:00', end: '23:00' },
}

export const TIME_PRESETS: Array<{ label: string; range: TimeRange }> = [
  { label: 'Ochtend', range: SLOT_RANGE.ochtend },
  { label: 'Namiddag', range: SLOT_RANGE.namiddag },
  { label: 'Avond', range: SLOT_RANGE.avond },
  { label: 'Hele dag', range: { start: '08:00', end: '22:00' } },
]

export const emptyDayHours = (): DayHours => ({ ranges: [], flexible: false })

export function toMinutes(t: string): number {
  if (t === '24:00') return 24 * 60
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function padTime(n: number): string {
  return String(n).padStart(2, '0')
}

export function fromMinutes(total: number): string {
  if (total >= 24 * 60) return '24:00'
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${padTime(h)}:${padTime(m)}`
}

export function timeOptions(step = 15): string[] {
  const out: string[] = []
  for (let m = 0; m <= 24 * 60; m += step) {
    out.push(fromMinutes(m))
  }
  return out
}

export const TIME_OPTIONS = timeOptions(15)

export function formatClock(t: string): string {
  if (t === '24:00') return '24:00'
  return t
}

export function formatRange(range: TimeRange): string {
  return `${formatClock(range.start)}–${formatClock(range.end)}`
}

export function formatDayHours(hours: DayHours | null | undefined): string {
  if (!hours) return 'Niet vrij'
  if (hours.flexible) return 'Flexibel · hele dag'
  if (hours.ranges.length === 0) return 'Niet vrij'
  return hours.ranges.map(formatRange).join(' · ')
}

export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end)
}

export function anyRangeOverlap(available: TimeRange[], needed: TimeRange[]): boolean {
  return available.some((a) => needed.some((b) => rangesOverlap(a, b)))
}

export function subtractRange(available: TimeRange, blocked: TimeRange): TimeRange[] {
  if (!rangesOverlap(available, blocked)) return [{ ...available }]
  const out: TimeRange[] = []
  if (toMinutes(available.start) < toMinutes(blocked.start)) {
    out.push({ start: available.start, end: blocked.start })
  }
  if (toMinutes(available.end) > toMinutes(blocked.end)) {
    out.push({ start: blocked.end, end: available.end })
  }
  return out.filter((r) => toMinutes(r.end) - toMinutes(r.start) >= 15)
}

export function subtractRanges(available: TimeRange[], blocked: TimeRange[]): TimeRange[] {
  let cur = available.map((r) => ({ ...r }))
  for (const b of blocked) {
    cur = cur.flatMap((a) => subtractRange(a, b))
  }
  return mergeRanges(cur)
}

export function applyBookedHours(hours: DayHours, booked: TimeRange[]): DayHours {
  if (!booked.length) return hours
  const base = hours.flexible ? [{ start: '00:00', end: '24:00' }] : hours.ranges
  return { flexible: false, ranges: subtractRanges(base, booked) }
}

export function mergeRanges(ranges: TimeRange[]): TimeRange[] {
  const sorted = [...ranges].sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
  const out: TimeRange[] = []
  for (const r of sorted) {
    const last = out[out.length - 1]
    if (last && toMinutes(r.start) <= toMinutes(last.end)) {
      if (toMinutes(r.end) > toMinutes(last.end)) last.end = r.end
    } else {
      out.push({ ...r })
    }
  }
  return out
}

export function dayHoursFromSlots(slots: Slot[]): DayHours {
  if (slots.includes('flexibel')) return { ranges: [], flexible: true }
  const ranges = mergeRanges(
    slots
      .filter((s): s is Exclude<Slot, 'flexibel'> => s !== 'flexibel')
      .map((s) => SLOT_RANGE[s]),
  )
  return { ranges, flexible: false }
}

export function rangeFromSlots(slots: Slot[]): TimeRange {
  const dh = dayHoursFromSlots(slots)
  if (dh.flexible) return { start: '08:00', end: '23:00' }
  if (dh.ranges.length === 0) return { start: '09:00', end: '17:00' }
  return {
    start: dh.ranges[0].start,
    end: dh.ranges[dh.ranges.length - 1].end,
  }
}

export function jobRange(job: Pick<Job, 'slots' | 'startTime' | 'endTime'>): TimeRange {
  if (job.startTime && job.endTime) return { start: job.startTime, end: job.endTime }
  return rangeFromSlots(job.slots)
}

export function isDayOpen(hours: DayHours | null | undefined): boolean {
  if (!hours) return false
  return hours.flexible || hours.ranges.length > 0
}

export function hasPreset(hours: DayHours, range: TimeRange): boolean {
  return hours.ranges.some((r) => r.start === range.start && r.end === range.end)
}

export function togglePreset(hours: DayHours, range: TimeRange): DayHours {
  const exists = hasPreset(hours, range)
  const ranges = exists
    ? hours.ranges.filter((r) => !(r.start === range.start && r.end === range.end))
    : mergeRanges([...hours.ranges, range])
  return { ...hours, flexible: false, ranges }
}

export function slotsFromRange(start: string, end: string): Slot[] {
  const slots: Slot[] = []
  const a = toMinutes(start)
  const b = toMinutes(end)
  if (a < 12 * 60 && b > 6 * 60) slots.push('ochtend')
  if (a < 18 * 60 && b > 12 * 60) slots.push('namiddag')
  if (a < 24 * 60 && b > 18 * 60) slots.push('avond')
  return slots.length > 0 ? slots : ['flexibel']
}

export function isoFromDate(d: Date): string {
  const y = d.getFullYear()
  const m = padTime(d.getMonth() + 1)
  const day = padTime(d.getDate())
  return `${y}-${m}-${day}`
}

export function calendarDates(weeks = 6): string[] {
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const dow = today.getDay()
  const mondayOffset = dow === 0 ? -6 : 1 - dow
  const start = new Date(today)
  start.setDate(today.getDate() + mondayOffset)
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return isoFromDate(d)
  })
}

export function isPastDate(iso: string): boolean {
  return iso < isoFromDate(new Date())
}
