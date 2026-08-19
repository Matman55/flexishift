import { useEffect, useRef, useState } from 'react'
import { Field, GhostButton, PrimaryButton, cardClass, inputClass } from './components'
import { MAIL_KIND_META, defaultMailPrefs } from './notify'
import { fetchMailStatus, isCloudEnabled, sendTestMail } from './cloud'
import { useStore } from './store'
import type { ChatMessage, Job, MailKind, MailLogItem, MailPrefs, Role, Seeker } from './types'

function visibleThread(messages: ChatMessage[], requestId: string): ChatMessage[] {
  const out: ChatMessage[] = []
  for (const m of messages) {
    if (m.requestId !== requestId) continue
    const prev = out[out.length - 1]
    if (
      prev &&
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

export function MailPrefsPanel({
  role,
  email,
  prefs,
  onEmail,
  onPrefs,
  log,
}: {
  role: Role
  email: string
  prefs: MailPrefs
  onEmail: (email: string) => void
  onPrefs: (prefs: MailPrefs) => void
  log: MailLogItem[]
}) {
  const store = useStore()
  const merged = { ...defaultMailPrefs(), ...prefs }
  const kinds = (Object.keys(MAIL_KIND_META) as MailKind[]).filter((k) => MAIL_KIND_META[k][role])
  const mine = log
    .filter((m) => email && m.to.toLowerCase() === email.trim().toLowerCase())
    .slice(0, 6)
  const real = Boolean(store.session?.userId)
  const [mailOk, setMailOk] = useState<boolean | null>(null)
  const [mailHint, setMailHint] = useState<string | null>(null)
  const [testBusy, setTestBusy] = useState(false)
  const [testMsg, setTestMsg] = useState<string | null>(null)
  const [testErr, setTestErr] = useState(false)

  useEffect(() => {
    if (!real || !isCloudEnabled()) {
      setMailOk(false)
      setMailHint(
        real
          ? 'Cloud is niet ingesteld, dus er vertrekt geen mail.'
          : 'In de demo vertrekt er geen mail. Log in met je eigen account om te testen.',
      )
      return
    }
    let cancelled = false
    void fetchMailStatus().then((s) => {
      if (cancelled) return
      if (s.error) {
        setMailOk(false)
        setMailHint(s.error)
        return
      }
      setMailOk(s.configured)
      setMailHint(
        s.configured
          ? 'Mails gaan via Resend. Zonder eigen domein komen ze alleen aan op het e-mailadres van je Resend-account (check ook spam).'
          : 'Resend is nog niet ingesteld. Plak supabase/setup_mail.sql in de SQL Editor, daarna je API-key (README stap 3).',
      )
    })
    return () => {
      cancelled = true
    }
  }, [real])

  const [testSql, setTestSql] = useState(false)

  const sendTest = async () => {
    setTestMsg(null)
    setTestBusy(true)
    const result = await sendTestMail()
    setTestBusy(false)
    if (result.ok) {
      setTestErr(false)
      setTestSql(false)
      setTestMsg('Testmail verstuurd. Check inbox én spam van het adres waarmee je bent ingelogd.')
    } else {
      setTestErr(true)
      setTestSql(/example\.com|not verified|resend_from/i.test(result.error))
      setTestMsg(result.error)
    }
  }

  return (
    <div className={`${cardClass} space-y-4 p-6`}>
      <div>
        <h2 className="text-lg font-semibold tracking-tight">E-mailmeldingen</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Je krijgt een mail wanneer er iets te doen is — een aanvraag, een bevestiging of een
          chatbericht. Zet alles uit, of kies alleen wat je wil.
        </p>
      </div>
      {mailHint && (
        <p
          className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
            mailOk ? 'bg-paper text-muted' : 'bg-amber-50 text-amber-950'
          }`}
        >
          {mailHint}
        </p>
      )}
      <Field label="E-mailadres">
        <input
          type="email"
          className={inputClass}
          value={email}
          placeholder="jij@voorbeeld.be"
          onChange={(e) => onEmail(e.target.value)}
        />
      </Field>
      {real && isCloudEnabled() && (
        <div className="space-y-2">
          <GhostButton onClick={() => void sendTest()} className="!py-2.5">
            {testBusy ? 'Versturen…' : 'Stuur testmail'}
          </GhostButton>
          {testMsg && (
            <p className={`text-sm leading-relaxed ${testErr ? 'text-red-700' : 'text-muted'}`}>{testMsg}</p>
          )}
          {testSql && (
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
              <p className="font-medium">
                In Supabase → SQL Editor: plak onderstaand, druk Ctrl+A (alles selecteren), daarna Run.
                Je moet onderaan <code className="text-xs">beth.t@example.com</code> zien.
              </p>
              <textarea
                readOnly
                className={`${inputClass} mt-2 min-h-[7rem] font-mono text-[11px] leading-snug`}
                value={`update public.app_config
set value = 'beth.t@example.com'
where key = 'resend_from';
insert into public.app_config (key, value)
values ('resend_from', 'beth.t@example.com')
on conflict (key) do update set value = excluded.value;
select value from public.app_config where key = 'resend_from';`}
              />
            </div>
          )}
        </div>
      )}
      <label className="flex items-center justify-between rounded-xl border border-line bg-paper px-4 py-3">
        <span className="text-sm font-medium">Alle e-mailmeldingen</span>
        <button
          type="button"
          onClick={() => onPrefs({ ...merged, enabled: !merged.enabled })}
          className={`h-7 w-11 rounded-full p-0.5 transition-colors duration-150 ${
            merged.enabled ? 'bg-terra' : 'bg-line'
          }`}
          aria-pressed={merged.enabled}
        >
          <span
            className={`block h-6 w-6 rounded-full bg-white shadow-sm transition ${
              merged.enabled ? 'translate-x-4' : ''
            }`}
          />
        </button>
      </label>
      <div className={`space-y-2 ${merged.enabled ? '' : 'pointer-events-none opacity-45'}`}>
        {kinds.map((kind) => (
          <label
            key={kind}
            className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-2.5"
          >
            <span className="text-sm">{MAIL_KIND_META[kind].label}</span>
            <input
              type="checkbox"
              className="h-4 w-4 accent-terra"
              checked={merged[kind]}
              onChange={(e) => onPrefs({ ...merged, [kind]: e.target.checked })}
            />
          </label>
        ))}
      </div>
      {mine.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Laatst verstuurd
          </div>
          <ul className="mt-2 space-y-2">
            {mine.map((m) => (
              <li key={m.id} className="rounded-lg bg-paper px-3 py-2 text-xs leading-relaxed">
                <span className="font-medium text-ink">{m.subject}</span>
                <span className="mt-0.5 block text-muted">
                  {m.skipped ? 'Niet verstuurd (voorkeur uit)' : m.error ? m.error : `Naar ${m.to}`}
                  {' · '}
                  {new Date(m.at).toLocaleString('nl-BE', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function ChatThread({
  requestId,
  role,
  peerName,
}: {
  requestId: string
  role: Role
  peerName: string
}) {
  const store = useStore()
  const [text, setText] = useState('')
  const [open, setOpen] = useState(true)
  const bottom = useRef<HTMLDivElement>(null)
  const thread = visibleThread(store.messages, requestId)
  const sending = useRef(false)
  const unread = thread.filter((m) =>
    m.from === role ? false : role === 'seeker' ? !m.readBySeeker : !m.readByEmployer,
  ).length
  const last = thread[thread.length - 1]

  useEffect(() => {
    if (!open) return
    store.markChatRead(requestId, role)
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    // markChatRead is stable; avoid depending on the whole store object
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, requestId, role, thread.length])

  const send = () => {
    const body = text.trim()
    if (!body || sending.current) return
    sending.current = true
    store.addMessage(requestId, role, body)
    setText('')
    setOpen(true)
    window.setTimeout(() => {
      sending.current = false
    }, 700)
  }

  return (
    <div className="mt-4 rounded-xl border border-line">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span>
          <span className="block text-sm font-semibold">Chat met {peerName}</span>
          <span className="mt-0.5 block text-xs text-muted">
            {last
              ? `${last.from === role ? 'Jij' : peerName}: ${last.text}`
              : 'Stuur een bericht over de shift, aankomst of kleding.'}
          </span>
        </span>
        {unread > 0 && (
          <span className="badge-accent shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="border-t border-line px-3 pb-3 pt-2">
          <div className="max-h-48 space-y-2 overflow-y-auto py-1">
            {thread.length === 0 && (
              <p className="px-1 py-2 text-xs text-muted">Nog geen berichten. Typ hieronder en druk op Stuur.</p>
            )}
            {thread.map((m) => {
              const mine = m.from === role
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      mine ? 'bg-ink text-cream' : 'bg-paper text-ink'
                    }`}
                  >
                    {m.text}
                    <div className={`mt-1 text-[10px] ${mine ? 'text-cream/60' : 'text-muted'}`}>
                      {new Date(m.createdAt).toLocaleTimeString('nl-BE', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={bottom} />
          </div>
          <div className="mt-2 flex gap-2">
            <input
              className={inputClass}
              value={text}
              placeholder={`Bericht naar ${peerName}…`}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
            />
            <PrimaryButton onClick={send} className="!px-3.5 !py-2.5 shrink-0">
              Stuur
            </PrimaryButton>
          </div>
        </div>
      )}
    </div>
  )
}

export function ChatBox({
  requestId,
  role,
  peerName,
}: {
  requestId: string
  role: Role
  peerName: string
}) {
  const store = useStore()
  const [text, setText] = useState('')
  const bottom = useRef<HTMLDivElement>(null)
  const thread = visibleThread(store.messages, requestId)
  const sending = useRef(false)

  useEffect(() => {
    store.markChatRead(requestId, role)
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, role, thread.length])

  const send = () => {
    const body = text.trim()
    if (!body || sending.current) return
    sending.current = true
    store.addMessage(requestId, role, body)
    setText('')
    window.setTimeout(() => {
      sending.current = false
    }, 700)
  }

  return (
    <div className="rounded-xl border border-line p-3">
      <div className="text-sm font-semibold">Chat met {peerName}</div>
      <div className="mt-2 max-h-52 space-y-2 overflow-y-auto">
        {thread.length === 0 && (
          <p className="py-2 text-xs text-muted">Nog geen berichten. Stuur de eerste.</p>
        )}
        {thread.map((m) => {
          const mine = m.from === role
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  mine ? 'bg-ink text-cream' : 'bg-paper text-ink'
                }`}
              >
                {m.text}
                <div className={`mt-1 text-[10px] ${mine ? 'text-cream/60' : 'text-muted'}`}>
                  {new Date(m.createdAt).toLocaleTimeString('nl-BE', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottom} />
      </div>
      <div className="mt-2 flex gap-2">
        <input
          className={inputClass}
          value={text}
          placeholder={`Bericht naar ${peerName}…`}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
        />
        <GhostButton onClick={send} className="!px-3.5 !py-2.5 shrink-0">
          Stuur
        </GhostButton>
      </div>
    </div>
  )
}

export function DirectChat({
  seekerId,
  employerId,
  jobId,
  role,
  peerName,
  intro,
}: {
  seekerId: string
  employerId: string
  jobId?: string | null
  role: Role
  peerName: string
  intro?: string
}) {
  const store = useStore()
  const [text, setText] = useState('')
  const bottom = useRef<HTMLDivElement>(null)
  const req = store.requests.find((r) => r.seekerId === seekerId && r.employerId === employerId)
  const thread = req ? visibleThread(store.messages, req.id) : []
  const sending = useRef(false)

  useEffect(() => {
    if (!req) return
    store.markChatRead(req.id, role)
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req?.id, role, thread.length])

  const send = () => {
    const body = text.trim()
    if (!body || sending.current) return
    sending.current = true
    store.sendChat({ seekerId, employerId, jobId, from: role, text: body })
    setText('')
    window.setTimeout(() => {
      sending.current = false
    }, 700)
  }

  return (
    <div className="rounded-xl border border-line p-3">
      <div className="text-sm font-semibold">Chat met {peerName}</div>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        {intro ?? 'Stel een vraag of stuur een bericht — ook zonder sollicitatie of aanvraag.'}
      </p>
      <div className="mt-2 max-h-52 space-y-2 overflow-y-auto">
        {thread.length === 0 && (
          <p className="py-2 text-xs text-muted">Nog geen berichten. Typ hieronder.</p>
        )}
        {thread.map((m) => {
          const mine = m.from === role
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  mine ? 'bg-ink text-cream' : 'bg-paper text-ink'
                }`}
              >
                {m.text}
                <div className={`mt-1 text-[10px] ${mine ? 'text-cream/60' : 'text-muted'}`}>
                  {new Date(m.createdAt).toLocaleTimeString('nl-BE', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottom} />
      </div>
      <div className="mt-2 flex gap-2">
        <input
          className={inputClass}
          value={text}
          placeholder={`Bericht naar ${peerName}…`}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
        />
        <PrimaryButton onClick={send} className="!px-3.5 !py-2.5 shrink-0">
          Stuur
        </PrimaryButton>
      </div>
    </div>
  )
}

export function SeekerProfileChat({ seeker }: { seeker: Seeker }) {
  const store = useStore()
  if (store.session?.role !== 'employer') return null
  return (
    <DirectChat
      seekerId={seeker.id}
      employerId={store.session.employerId}
      role="employer"
      peerName={seeker.name}
      intro="Vraag of ze vrij is, of stuur een bericht vóór je een shift vraagt."
    />
  )
}

export function JobInquiryChat({ job }: { job: Job }) {
  const store = useStore()
  if (store.session?.role !== 'seeker') return null
  const company =
    store.employers.find((e) => e.id === job.employerId)?.company ?? job.company
  return (
    <DirectChat
      seekerId={store.session.seekerId}
      employerId={job.employerId}
      jobId={job.id}
      role="seeker"
      peerName={company}
      intro="Vraag iets over deze job vóór je solliciteert."
    />
  )
}
