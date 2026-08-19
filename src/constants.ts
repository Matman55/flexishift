import type { ContractKind, Slot, Transport, Weekday, Workplace } from './types'

export const SLOT_META: Record<
  Slot,
  { label: string; hint: string; time: string }
> = {
  ochtend: { label: 'Ochtend', hint: 'Vanaf de start van de dag', time: '06–12u' },
  namiddag: { label: 'Namiddag', hint: 'Rond de middag tot einde namiddag', time: '12–18u' },
  avond: { label: 'Avond', hint: 'Avondshift of late dienst', time: '18–00u' },
  flexibel: { label: 'Flexibel', hint: 'Maakt niet uit wanneer die dag', time: 'hele dag' },
}

export const WEEKDAY_META: Record<Weekday, { short: string; long: string }> = {
  mon: { short: 'Ma', long: 'Maandag' },
  tue: { short: 'Di', long: 'Dinsdag' },
  wed: { short: 'Wo', long: 'Woensdag' },
  thu: { short: 'Do', long: 'Donderdag' },
  fri: { short: 'Vr', long: 'Vrijdag' },
  sat: { short: 'Za', long: 'Zaterdag' },
  sun: { short: 'Zo', long: 'Zondag' },
}

export const CITIES = [
  'Gent',
  'Antwerpen',
  'Brussel',
  'Leuven',
  'Brugge',
  'Mechelen',
  'Hasselt',
  'Kortrijk',
  'Oostende',
  'Aalst',
]

export const SECTORS = [
  'Horeca',
  'Retail',
  'Events',
  'Logistiek',
  'Zorg',
  'Administratie',
  'Schoonmaak',
  'Productie',
]

export const SKILLS = [
  'Bediening',
  'Bar / tappen',
  'Keuken',
  'Kassa',
  'Magazijn',
  'Picking',
  'Hostess / onthaal',
  'Eventopbouw',
  'Schoonmaak',
  'Zorgondersteuning',
  'Administratie',
  'Klantenservice',
  'Chauffeur',
  'Productie',
]

export const LANGUAGES = ['Nederlands', 'Frans', 'Engels', 'Duits', 'Arabisch', 'Turks']

export function emptyRecurring(): Record<Weekday, Slot[]> {
  return {
    mon: [],
    tue: [],
    wed: [],
    thu: [],
    fri: [],
    sat: [],
    sun: [],
  }
}

export function isoDate(offsetDays = 0): string {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + offsetDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('nl-BE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export function formatEuro(n: number, compact = false): string {
  return new Intl.NumberFormat('nl-BE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: compact ? 0 : 2,
    minimumFractionDigits: compact ? 0 : 2,
  }).format(n)
}

export function formatHours(n: number): string {
  return `${new Intl.NumberFormat('nl-BE', { maximumFractionDigits: 1 }).format(n)} u`
}

export function formatDateLong(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('nl-BE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export function formatJobDay(iso: string): {
  relative: string | null
  weekday: string
  dayMonth: string
  label: string
} {
  const today = isoDate(0)
  const tomorrow = isoDate(1)
  const d = new Date(iso + 'T12:00:00')
  const rawWeekday = d.toLocaleDateString('nl-BE', { weekday: 'long' })
  const weekday = rawWeekday.charAt(0).toUpperCase() + rawWeekday.slice(1)
  const dayMonth = d.toLocaleDateString('nl-BE', { day: 'numeric', month: 'long' })
  const relative = iso === today ? 'Vandaag' : iso === tomorrow ? 'Morgen' : null
  const label = relative ? `${relative} · ${weekday} ${dayMonth}` : `${weekday} ${dayMonth}`
  return { relative, weekday, dayMonth, label }
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}

export function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

export function nextDays(count: number): string[] {
  return Array.from({ length: count }, (_, i) => isoDate(i))
}

export const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  Gent: { lat: 51.0543, lng: 3.7174 },
  Antwerpen: { lat: 51.2194, lng: 4.4025 },
  Brussel: { lat: 50.8503, lng: 4.3517 },
  Leuven: { lat: 50.8798, lng: 4.7005 },
  Brugge: { lat: 51.2093, lng: 3.2247 },
  Mechelen: { lat: 51.0259, lng: 4.4776 },
  Hasselt: { lat: 50.9307, lng: 5.3378 },
  Kortrijk: { lat: 50.8279, lng: 3.2649 },
  Oostende: { lat: 51.2303, lng: 2.92 },
  Aalst: { lat: 50.9378, lng: 4.04 },
}

export const CITY_POSTAL: Record<string, string> = {
  Gent: '9000',
  Antwerpen: '2000',
  Brussel: '1000',
  Leuven: '3000',
  Brugge: '8000',
  Mechelen: '2800',
  Hasselt: '3500',
  Kortrijk: '8500',
  Oostende: '8400',
  Aalst: '9300',
}

export function workplaceFromCity(city: string, extra?: Partial<Workplace>): Workplace {
  const coords = CITY_COORDS[city] ?? CITY_COORDS.Gent
  return {
    address: extra?.address ?? `Centrum ${city}`,
    postal: extra?.postal ?? CITY_POSTAL[city] ?? '9000',
    city,
    lat: extra?.lat ?? coords.lat,
    lng: extra?.lng ?? coords.lng,
    access: extra?.access,
    parking: extra?.parking,
    contactOnSite: extra?.contactOnSite,
    notes: extra?.notes,
  }
}

export function ensureWorkplace(job: { city: string; workplace?: Workplace | null }): Workplace {
  if (job.workplace?.lat && job.workplace?.lng) return job.workplace
  return workplaceFromCity(job.city, job.workplace ?? undefined)
}

export function osmEmbedUrl(lat: number, lng: number, delta = 0.007): string {
  const bbox = [lng - delta, lat - delta * 0.62, lng + delta, lat + delta * 0.62]
    .map((n) => n.toFixed(6))
    .join('%2C')
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(6)}%2C${lng.toFixed(6)}`
}

export function googleMapsDirUrl(wp: Workplace): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${wp.lat},${wp.lng}`
}

export function workplaceLine(wp: Workplace): string {
  return `${wp.address}, ${wp.postal} ${wp.city}`
}

export const CONTRACT_META: Record<ContractKind, { label: string; hint: string }> = {
  flexi: {
    label: 'Flexi',
    hint: 'Voor wie al een hoofdjob heeft. Dimona regelt de zaak.',
  },
  extra: {
    label: 'Extra',
    hint: 'Occasionele extra. Dimona regelt de zaak.',
  },
  student: {
    label: 'Student',
    hint: 'Binnen het studentencontingent. Dimona regelt de zaak.',
  },
}

export const TRANSPORTS: { id: Transport; label: string }[] = [
  { id: 'fiets', label: 'Fiets' },
  { id: 'auto', label: 'Auto' },
  { id: 'ov', label: 'Openbaar' },
  { id: 'te voet', label: 'Te voet' },
]

export function defaultContract(sector: string): ContractKind {
  if (sector === 'Events' || sector === 'Logistiek') return 'extra'
  return 'flexi'
}

export function cityCoords(city: string): { lat: number; lng: number } {
  return CITY_COORDS[city] ?? CITY_COORDS.Gent
}

function toRad(n: number) {
  return (n * Math.PI) / 180
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}

export function distanceKm(
  fromCity: string,
  to: { city: string; lat?: number; lng?: number },
): number {
  const a = cityCoords(fromCity)
  const b = to.lat != null && to.lng != null ? { lat: to.lat, lng: to.lng } : cityCoords(to.city)
  return Math.round(haversineKm(a, b) * 10) / 10
}

export function distanceScore(km: number): number {
  if (km <= 3) return 1
  if (km <= 8) return 0.8
  if (km <= 15) return 0.55
  if (km <= 30) return 0.3
  return 0.1
}

export function travelLabel(km: number, hasTransport: boolean): string {
  const kmTxt =
    km < 1
      ? `${Math.max(100, Math.round(km * 1000))} m`
      : `${String(km < 10 ? km.toFixed(1) : Math.round(km)).replace('.', ',')} km`
  if (km < 0.35) return 'Om de hoek'
  if (km < 1.2) return `${kmTxt} · ${Math.max(4, Math.round((km / 5) * 60))} min te voet`
  const bike = Math.max(4, Math.round((km / 15) * 60))
  if (!hasTransport || km <= 7) return `${kmTxt} · ${bike} min fiets`
  const car = Math.max(8, Math.round((km / 28) * 60) + 4)
  return `${kmTxt} · ±${car} min auto`
}

export function shiftCountdown(date: string, startTime?: string, endTime?: string): {
  label: string
  urgent: boolean
  past: boolean
  soon: boolean
} {
  const startH = startTime && startTime !== '24:00' ? startTime : '09:00'
  const start = new Date(`${date}T${startH}:00`)
  const endH = !endTime || endTime === '24:00' ? '23:59' : endTime
  const end = new Date(`${date}T${endH}:00`)
  const now = new Date()
  if (now.getTime() > end.getTime()) return { label: 'Voorbij', urgent: false, past: true, soon: false }
  if (now.getTime() >= start.getTime()) return { label: 'Nu bezig', urgent: true, past: false, soon: true }
  const mins = Math.round((start.getTime() - now.getTime()) / 60000)
  if (mins < 60) return { label: `Nog ${mins} min`, urgent: true, past: false, soon: true }
  const hours = Math.round(mins / 60)
  if (hours < 24) return { label: `Nog ${hours} u`, urgent: hours <= 6, past: false, soon: mins <= 120 }
  const days = Math.round(hours / 24)
  return { label: `Over ${days} dag${days === 1 ? '' : 'en'}`, urgent: false, past: false, soon: false }
}
