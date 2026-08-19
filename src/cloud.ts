import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { withMailDefaults } from './notify'
import type { AppState, ChatMessage, Employer, Job, MailLogItem, Role, Seeker, Session, WorkRequest } from './types'

export function isCloudEnabled(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
}

export function appUrl(): string {
  return new URL('.', window.location.href).href
}

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!isCloudEnabled()) throw new Error('Cloud is niet geconfigureerd')
  if (!client) {
    client = createClient(import.meta.env.VITE_SUPABASE_URL!, import.meta.env.VITE_SUPABASE_ANON_KEY!, {
      auth: {
        persistSession: true,
        detectSessionInUrl: true,
        autoRefreshToken: true,
      },
    })
  }
  return client
}

type Row = { id: string; data: unknown }

function uniqueById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const row of rows) {
    if (!row?.id || seen.has(row.id)) continue
    seen.add(row.id)
    out.push(row)
  }
  return out
}

function dedupeChat(messages: ChatMessage[]): ChatMessage[] {
  const sorted = uniqueById(messages).sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  )
  const out: ChatMessage[] = []
  for (const m of sorted) {
    const prev = out[out.length - 1]
    if (
      prev &&
      prev.requestId === m.requestId &&
      prev.from === m.from &&
      prev.text.trim() === m.text.trim() &&
      Math.abs(Date.parse(prev.createdAt) - Date.parse(m.createdAt)) < 4000
    ) {
      continue
    }
    out.push(m)
  }
  return out
}

function asSeeker(raw: unknown): Seeker {
  const s = raw as Seeker
  return withMailDefaults({ ...s, hours: s.hours ?? {} }, s.name || 'flexi')
}

function asEmployer(raw: unknown): Employer {
  const e = raw as Employer
  return withMailDefaults(
    {
      ...e,
      onboardingDone: e.onboardingDone !== false,
      favorites: e.favorites ?? [],
      savedSearches: e.savedSearches ?? [],
    },
    e.contact || e.company || 'zaak',
  )
}

export async function fetchMarket(): Promise<Omit<AppState, 'session'>> {
  const sb = getSupabase()
  const [seekers, employers, jobs, requests, messages] = await Promise.all([
    sb.from('seekers').select('data'),
    sb.from('employers').select('data'),
    sb.from('jobs').select('data'),
    sb.from('requests').select('data'),
    sb.from('messages').select('data'),
  ])
  const err = seekers.error || employers.error || jobs.error || requests.error || messages.error
  if (err) throw err
  return {
    seekers: ((seekers.data as Row[]) ?? []).map((r) => asSeeker(r.data)),
    employers: ((employers.data as Row[]) ?? []).map((r) => asEmployer(r.data)),
    jobs: uniqueById(((jobs.data as Row[]) ?? []).map((r) => r.data as Job)),
    requests: uniqueById(((requests.data as Row[]) ?? []).map((r) => r.data as WorkRequest)),
    messages: dedupeChat(((messages.data as Row[]) ?? []).map((r) => r.data as ChatMessage)),
    mailLog: [],
  }
}

export async function sessionFromUser(
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> },
  market: Pick<AppState, 'seekers' | 'employers'>,
): Promise<Session | null> {
  const seeker = market.seekers.find((s) => s.userId === user.id)
  if (seeker) {
    return {
      role: 'seeker',
      seekerId: seeker.id,
      employerId: market.employers[0]?.id ?? 'e-none',
      userId: user.id,
      email: user.email || seeker.email || undefined,
    }
  }
  const employer = market.employers.find((e) => e.userId === user.id)
  if (employer) {
    return {
      role: 'employer',
      seekerId: market.seekers[0]?.id ?? 's-none',
      employerId: employer.id,
      userId: user.id,
      email: user.email || employer.email || undefined,
    }
  }
  const role = (user.user_metadata?.role as Role | undefined) ?? 'seeker'
  const { data } =
    role === 'employer'
      ? await getSupabase().from('employers').select('id, data').eq('user_id', user.id).maybeSingle()
      : await getSupabase().from('seekers').select('id, data').eq('user_id', user.id).maybeSingle()
  if (!data) return null
  if (role === 'employer') {
    return {
      role,
      seekerId: market.seekers[0]?.id ?? 's-none',
      employerId: data.id,
      userId: user.id,
      email: user.email || undefined,
    }
  }
  return {
    role,
    seekerId: data.id,
    employerId: market.employers[0]?.id ?? 'e-none',
    userId: user.id,
    email: user.email || undefined,
  }
}

function changed<T extends { id: string }>(prev: T[], next: T[]): T[] {
  const old = new Map(prev.map((x) => [x.id, JSON.stringify(x)]))
  return next.filter((row) => old.get(row.id) !== JSON.stringify(row))
}

export async function syncCloud(prev: AppState, next: AppState): Promise<void> {
  const userId = next.session?.userId
  if (!userId || !isCloudEnabled()) return
  const sb = getSupabase()
  const mySeeker = next.session?.role === 'seeker' ? next.session.seekerId : null
  const myEmployer = next.session?.role === 'employer' ? next.session.employerId : null

  const upsert = async (table: string, id: string, extra: Record<string, unknown>, data: unknown) => {
    const { error } = await sb.from(table).upsert({ id, data, updated_at: new Date().toISOString(), ...extra })
    if (error) console.warn('Sync', table, error.message)
  }

  for (const s of changed(prev.seekers, next.seekers)) {
    if (s.userId !== userId && s.id !== mySeeker) continue
    await upsert('seekers', s.id, { user_id: s.userId ?? userId }, s)
  }
  for (const e of changed(prev.employers, next.employers)) {
    if (e.userId !== userId && e.id !== myEmployer) continue
    await upsert('employers', e.id, { user_id: e.userId ?? userId }, e)
  }
  for (const j of changed(prev.jobs, next.jobs)) {
    if (j.employerId !== myEmployer && !next.requests.some((r) => r.jobId === j.id && r.seekerId === mySeeker)) {
      continue
    }
    await upsert('jobs', j.id, { employer_id: j.employerId }, j)
  }
  for (const r of changed(prev.requests, next.requests)) {
    if (r.seekerId !== mySeeker && r.employerId !== myEmployer) continue
    await upsert('requests', r.id, { seeker_id: r.seekerId, employer_id: r.employerId, job_id: r.jobId }, r)
  }
  for (const m of changed(prev.messages, next.messages)) {
    const req = next.requests.find((r) => r.id === m.requestId)
    if (!req || (req.seekerId !== mySeeker && req.employerId !== myEmployer)) continue
    await upsert('messages', m.id, { request_id: m.requestId }, m)
  }
}

export async function sendCloudMail(item: MailLogItem): Promise<string | null> {
  if (!isCloudEnabled() || item.skipped) return null
  if (item.to.toLowerCase().endsWith('@flexishift.be')) return 'Demo-adressen krijgen geen mail.'
  const { data, error } = await getSupabase().rpc('deliver_flexi_mail', {
    p_to: item.to,
    p_to_name: item.toName,
    p_subject: item.subject,
    p_preview: item.preview,
  })
  if (error) {
    const msg = mailRpcMessage(null, error.message)
    console.warn('Mail', msg)
    return msg
  }
  const row = data as MailRpcResult
  if (row && row.ok === false) {
    const msg = mailRpcMessage(row)
    console.warn('Mail', msg)
    return msg
  }
  return null
}

type MailRpcResult = {
  ok?: boolean
  reason?: string
  detail?: string
  configured?: boolean
  from?: string
}

export function mailRpcMessage(data: MailRpcResult | null | undefined, rpcError?: string): string {
  if (rpcError) {
    const m = rpcError.toLowerCase()
    if (m.includes('could not find') || m.includes('does not exist') || m.includes('schema cache')) {
      return 'Mailfunctie ontbreekt nog. Plak supabase/setup_mail.sql in de SQL Editor en druk op Run.'
    }
    return rpcError
  }
  if (!data) return 'Geen antwoord van de mailserver.'
  if (data.ok) return ''
  switch (data.reason) {
    case 'mail_not_configured':
      return 'Resend is nog niet ingesteld. Zet je API-key in Supabase (README, stap 3).'
    case 'unknown_recipient':
      return 'Dit adres staat niet als FlexiShift-gebruiker.'
    case 'demo_address':
      return 'Demo-adressen (@flexishift.be) krijgen geen mail.'
    case 'missing_address':
      return 'Geen e-mailadres op dit account.'
    case 'resend': {
      const d = (data.detail ?? '').toLowerCase()
      if (d.includes('only send testing') || d.includes('own email')) {
        return 'Resend stuurt testmails alleen naar het adres van je Resend-account. Log bij Resend in met hetzelfde Gmail-adres als in FlexiShift, check spam, of koop later een eigen domein.'
      }
      if (d.includes('api key') || d.includes('invalid api')) {
        return 'De Resend API-key klopt niet. Maak een nieuwe key en sla die op in app_config.'
      }
      return data.detail || 'Resend weigerde de mail.'
    }
    case 'http_failed':
      return ['Mailserver bereikt Resend niet.', data.detail].filter(Boolean).join(' ')
    default:
      return data.detail || 'Mail versturen mislukte.'
  }
}

export async function fetchMailStatus(): Promise<{
  configured: boolean
  from: string
  error?: string
}> {
  if (!isCloudEnabled()) {
    return { configured: false, from: '', error: 'Cloud is niet ingesteld.' }
  }
  const { data, error } = await getSupabase().rpc('flexi_mail_status')
  if (error) return { configured: false, from: '', error: mailRpcMessage(null, error.message) }
  const row = data as MailRpcResult
  return { configured: Boolean(row?.configured), from: row?.from ?? '' }
}

export async function sendTestMail(): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await getSupabase().rpc('flexi_send_test_mail')
  if (error) return { ok: false, error: mailRpcMessage(null, error.message) }
  const row = data as MailRpcResult
  if (row?.ok) return { ok: true }
  return { ok: false, error: mailRpcMessage(row) }
}

export function subscribeMarket(onChange: () => void): () => void {
  if (!isCloudEnabled()) return () => {}
  const sb = getSupabase()
  const ch = sb
    .channel('flexishift-market')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'seekers' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'employers' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, onChange)
    .subscribe()
  return () => {
    void sb.removeChannel(ch)
  }
}

export async function deleteOwnAccount(): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = getSupabase()
  const { error } = await sb.rpc('delete_own_account')
  if (error) {
    const m = (error.message ?? '').toLowerCase()
    if (m.includes('could not find') || m.includes('does not exist') || m.includes('schema cache')) {
      return {
        ok: false,
        error:
          'Account verwijderen is nog niet ingesteld in Supabase. Plak supabase/setup_delete_account.sql in de SQL Editor en druk op Run.',
      }
    }
    return { ok: false, error: authErrorMessage(error) }
  }
  try {
    await sb.auth.signOut()
  } catch {
    /* sessie is al weg samen met de user */
  }
  return { ok: true }
}

export function authErrorMessage(err: { message?: string } | null | undefined): string {
  const m = (err?.message ?? '').toLowerCase()
  if (!m) return 'Er ging iets mis. Probeer opnieuw.'
  if (m.includes('invalid login')) return 'E-mail of wachtwoord klopt niet.'
  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'Dit e-mailadres heeft al een account. Log in.'
  }
  if (m.includes('password')) return 'Kies een wachtwoord van minstens 6 tekens.'
  if (m.includes('rate')) return 'Te veel pogingen. Wacht even.'
  if (m.includes('confirm')) return 'Bevestig eerst je e-mail via de link in je inbox.'
  return err?.message ?? 'Er ging iets mis. Probeer opnieuw.'
}
