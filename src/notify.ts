import { uid } from './constants'
import type {
  AppState,
  ChatMessage,
  Employer,
  Job,
  MailKind,
  MailLogItem,
  MailPrefs,
  Role,
  Seeker,
  WorkRequest,
} from './types'

export const defaultMailPrefs = (): MailPrefs => ({
  enabled: true,
  ask: true,
  apply: true,
  accepted: true,
  declined: true,
  cancelled: true,
  message: true,
  job: true,
  welcome: true,
})

export function demoEmail(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
  return `${slug || 'gebruiker'}@flexishift.be`
}

export function withMailDefaults<T extends Seeker | Employer>(person: T, fallbackName: string): T {
  return {
    ...person,
    email: person.email?.trim() || demoEmail(fallbackName),
    mailPrefs: { ...defaultMailPrefs(), ...person.mailPrefs },
  }
}

export const MAIL_KIND_META: Record<
  MailKind,
  { label: string; seeker: boolean; employer: boolean }
> = {
  ask: { label: 'Aanvraag van een zaak', seeker: true, employer: false },
  apply: { label: 'Sollicitatie van een flexi', seeker: false, employer: true },
  accepted: { label: 'Job bevestigd', seeker: true, employer: true },
  declined: { label: 'Aanvraag afgewezen', seeker: true, employer: true },
  cancelled: { label: 'Shift geannuleerd', seeker: true, employer: true },
  message: { label: 'Nieuw chatbericht', seeker: true, employer: true },
  job: { label: 'Nieuwe job in de buurt', seeker: true, employer: false },
  welcome: { label: 'Welkom bij je account', seeker: true, employer: true },
}

function wants(prefs: MailPrefs | undefined, kind: MailKind): boolean {
  const p = { ...defaultMailPrefs(), ...prefs }
  if (!p.enabled) return false
  return p[kind]
}

function recipient(
  state: AppState,
  role: Role,
  request: WorkRequest,
): { email: string; name: string; prefs?: MailPrefs } | null {
  if (role === 'seeker') {
    const s = state.seekers.find((x) => x.id === request.seekerId)
    if (!s) return null
    return { email: s.email || demoEmail(s.name), name: s.name, prefs: s.mailPrefs }
  }
  const e = state.employers.find((x) => x.id === request.employerId)
  if (!e) return null
  return {
    email: e.email || demoEmail(e.contact || e.company),
    name: e.contact || e.company,
    prefs: e.mailPrefs,
  }
}

function compose(
  kind: MailKind,
  request: WorkRequest,
  state: AppState,
  extra?: string,
): { subject: string; preview: string } {
  const seeker = state.seekers.find((s) => s.id === request.seekerId)?.name ?? 'Flexi'
  const company = state.employers.find((e) => e.id === request.employerId)?.company ?? 'een zaak'
  const when = request.date
  const job = request.title
  switch (kind) {
    case 'ask':
      return {
        subject: `${company} vraagt je voor “${job}”`,
        preview: `${company} wil je op ${when} voor ${job}. Open FlexiShift om te antwoorden.`,
      }
    case 'apply':
      return {
        subject: `${seeker} wil “${job}” doen`,
        preview: `${seeker} solliciteerde voor ${job} op ${when}. Open je inbox om te bevestigen.`,
      }
    case 'accepted':
      return {
        subject: `Bevestigd: ${job}`,
        preview: `De shift “${job}” op ${when} is bevestigd tussen ${seeker} en ${company}.`,
      }
    case 'declined':
      return {
        subject: `Niet doorgegaan: ${job}`,
        preview: `De aanvraag voor “${job}” op ${when} is afgewezen.`,
      }
    case 'cancelled':
      return {
        subject: `Geannuleerd: ${job}`,
        preview: `De shift “${job}” op ${when} is geannuleerd.`,
      }
    case 'message':
      return {
        subject: `Nieuw bericht over “${job}”`,
        preview: extra?.trim() || `Er staat een nieuw bericht klaar over ${job}.`,
      }
    case 'job':
      return {
        subject: `Nieuwe job: “${job}”`,
        preview: `${company} zoekt iemand op ${when} voor ${job}. Open FlexiShift om te solliciteren.`,
      }
    case 'welcome':
      return {
        subject: 'Welkom bij FlexiShift',
        preview: 'Je account is aangemaakt. Open FlexiShift om je profiel af te ronden.',
      }
  }
}

export function buildMail(
  state: AppState,
  kind: MailKind,
  toRole: Role,
  request: WorkRequest,
  extra?: string,
): MailLogItem | null {
  const to = recipient(state, toRole, request)
  if (!to) return null
  const { subject, preview } = compose(kind, request, state, extra)
  const skipped = !wants(to.prefs, kind) || !to.email
  return {
    id: uid('mail'),
    at: new Date().toISOString(),
    to: to.email,
    toName: to.name,
    kind,
    subject,
    preview,
    skipped,
  }
}

export function counterpart(from: Role): Role {
  return from === 'seeker' ? 'employer' : 'seeker'
}

export function buildWelcomeMail(email: string, name: string, role: Role): MailLogItem {
  const who = role === 'employer' ? 'zaak' : 'flexi'
  return {
    id: uid('mail'),
    at: new Date().toISOString(),
    to: email.trim(),
    toName: name.trim() || 'daar',
    kind: 'welcome',
    subject: 'Welkom bij FlexiShift',
    preview: `Je ${who}-account is aangemaakt. Vul je profiel in — dan kun je jobs plaatsen of aannemen.`,
    skipped: !email.trim() || email.toLowerCase().endsWith('@flexishift.be'),
  }
}

export function buildJobPostMail(job: Job, seeker: Seeker): MailLogItem | null {
  const email = seeker.email?.trim() || demoEmail(seeker.name)
  const skipped = !wants(seeker.mailPrefs, 'job') || !email
  const when = job.startTime ? `${job.date} ${job.startTime}–${job.endTime}` : job.date
  return {
    id: uid('mail'),
    at: new Date().toISOString(),
    to: email,
    toName: seeker.name,
    kind: 'job',
    subject: `Nieuwe job: “${job.title}” bij ${job.company}`,
    preview: `${job.company} zoekt iemand op ${when}. Open FlexiShift → Jobs om te solliciteren.`,
    skipped,
  }
}

export function mailHint(
  state: AppState,
  kind: MailKind,
  toRole: Role,
  request: Pick<WorkRequest, 'seekerId' | 'employerId' | 'title' | 'date'>,
): string {
  const item = buildMail(state, kind, toRole, request as WorkRequest)
  if (!item || item.skipped) return ''
  return ` · e-mail naar ${item.to}`
}

export async function deliverMail(item: MailLogItem): Promise<void> {
  if (item.skipped) return
  if (item.to.toLowerCase().endsWith('@flexishift.be')) return
  try {
    const { isCloudEnabled, sendCloudMail } = await import('./cloud')
    if (isCloudEnabled()) {
      await sendCloudMail(item)
      return
    }
  } catch {
    /* ignore */
  }
  const endpoint = import.meta.env.VITE_EMAIL_ENDPOINT as string | undefined
  if (!endpoint) return
  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    })
  } catch {
    /* offline */
  }
}

export function unreadChatCount(
  messages: ChatMessage[],
  requestIds: Set<string>,
  role: Role,
): number {
  return messages.filter((m) => {
    if (!requestIds.has(m.requestId)) return false
    if (m.from === role) return false
    return role === 'seeker' ? !m.readBySeeker : !m.readByEmployer
  }).length
}
