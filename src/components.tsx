import { useEffect, useState, type ReactNode } from 'react'
import {
  SLOT_META,
  WEEKDAY_META,
  formatDate,
  formatDateLong,
  formatEuro,
  formatHours,
  initials,
  osmEmbedUrl,
  osmOpenUrl,
  googleMapsDirUrl,
  appleMapsDirUrl,
  workplaceLine,
  ensureWorkplace,
  CONTRACT_META,
  TRANSPORTS,
  shiftCountdown,
} from './constants'
import { weekdayFromIso } from './data'
import { slotsOnDate } from './match'
import { WEEKDAYS, type ApplyExtras, type ContractKind, type DayHours, type Job, type Recurring, type Role, type Seeker, type ShiftFeedback, type Slot, type Transport, type Weekday, type WorkRequest, type Workplace } from './types'
import { formatRange } from './time'

export const cardClass = 'rounded-2xl border border-line bg-cream shadow-[0_10px_30px_rgba(17,17,17,0.06)]'
export const inputClass =
  'w-full rounded-lg border border-line bg-cream px-3.5 py-2.5 text-sm text-ink outline-none transition duration-150 placeholder:text-muted hover:border-zinc-300 focus:border-terra focus:ring-4 focus:ring-terra/25'

export function Avatar({
  name,
  hue,
  size = 'md',
  photo,
}: {
  name: string
  hue: number
  size?: 'sm' | 'md' | 'lg'
  photo?: string
}) {
  const dim =
    size === 'sm'
      ? 'h-9 w-9 text-xs rounded-full'
      : size === 'lg'
        ? 'h-16 w-16 text-xl rounded-full'
        : 'h-11 w-11 text-sm rounded-full'
  if (photo) {
    return <img src={photo} alt="" className={`${dim} shrink-0 object-cover`} />
  }
  return (
    <div
      className={`${dim} grid place-items-center font-medium text-white shrink-0`}
      style={{
        background: `linear-gradient(145deg, hsl(${hue} 42% 42%), hsl(${hue} 38% 26%))`,
      }}
    >
      {initials(name || '?')}
    </div>
  )
}

export function SeekerProfile({
  seeker,
  onClose,
  extra,
}: {
  seeker: Seeker
  onClose: () => void
  extra?: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="seeker-profile-title"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-line bg-cream shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-line bg-cream/95 px-5 py-4 backdrop-blur">
          <div className="flex min-w-0 items-start gap-3">
            <Avatar name={seeker.name} hue={seeker.hue} size="lg" photo={seeker.photo} />
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Profiel</div>
              <h2 id="seeker-profile-title" className="mt-0.5 text-lg font-semibold tracking-tight">
                {seeker.name}
              </h2>
              <p className="mt-0.5 flex items-center gap-1 text-sm text-muted">
                <Icon name="pin" className="h-3.5 w-3.5" /> {seeker.city}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-cream hover:bg-paper"
            aria-label="Sluiten"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-5 p-5">
          {seeker.bio && <p className="text-sm leading-relaxed text-muted">{seeker.bio}</p>}
          <div className="flex flex-wrap gap-1.5 text-[11px] font-medium">
            {seeker.lastMinute && <span className="badge-accent rounded-md px-2 py-0.5">last-minute</span>}
            {seeker.hasTransport && <span className="badge-muted rounded-md px-2 py-0.5">eigen vervoer</span>}
            {seeker.hasLicense && <span className="badge-muted rounded-md px-2 py-0.5">rijbewijs B</span>}
            <span className="badge-muted rounded-md px-2 py-0.5">vanaf €{seeker.hourlyRateMin}/u</span>
            <span className="badge-muted rounded-md px-2 py-0.5">{seeker.yearsExperience} jaar ervaring</span>
          </div>
          {extra}
          {seeker.sectors.length > 0 && (
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Sectoren</div>
              <div className="flex flex-wrap gap-1.5">
                {seeker.sectors.map((s) => (
                  <span key={s} className="rounded-md bg-terra/25 px-2 py-0.5 text-[11px] font-medium">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {seeker.skills.length > 0 && (
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Skills</div>
              <div className="flex flex-wrap gap-1.5">
                {seeker.skills.map((s) => (
                  <span key={s} className="rounded-md bg-paper px-2 py-0.5 text-[11px] font-medium text-muted">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {seeker.languages.length > 0 && (
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Talen</div>
              <p className="text-sm text-ink">{seeker.languages.join(' · ')}</p>
            </div>
          )}
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Vaste week</div>
            <p className="mb-2 text-xs leading-relaxed text-muted">
              Wanneer deze persoon meestal vrij is. Ochtend 06–12u, namiddag 12–18u, avond 18–00u.
            </p>
            <RecurringWeekPreview recurring={seeker.recurring} />
          </div>
        </div>
      </div>
    </div>
  )
}

export function OpenSeekerProfile({
  seeker,
  className = '',
  children,
}: {
  seeker: Seeker
  className?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={`cursor-pointer ${className}`} onClick={() => setOpen(true)}>
        {children}
      </button>
      {open && <SeekerProfile seeker={seeker} onClose={() => setOpen(false)} />}
    </>
  )
}

export function RecurringWeekPreview({ recurring }: { recurring: Recurring }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      {WEEKDAYS.map((day) => {
        const slots = recurring[day] ?? []
        return (
          <div
            key={day}
            className="flex items-center justify-between gap-3 border-b border-line px-3 py-2.5 last:border-b-0"
          >
            <div className="w-[5.5rem] shrink-0 text-sm font-semibold">{WEEKDAY_META[day].long}</div>
            <div className="flex min-w-0 flex-1 flex-wrap justify-end gap-1.5">
              {slots.length === 0 ? (
                <span className="text-sm text-muted">Niet vrij</span>
              ) : (
                slots.map((s) => (
                  <span
                    key={s}
                    className={`slot-${s} rounded-md px-2 py-0.5 text-[11px] font-medium`}
                  >
                    {SLOT_META[s].label}
                    <span className="ml-1 opacity-75">{SLOT_META[s].time}</span>
                  </span>
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function SlotPills({ slots }: { slots: Slot[] }) {
  if (slots.length === 0) {
    return <span className="text-xs text-muted">Niet vrij</span>
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {slots.map((s) => (
        <span
          key={s}
          className={`slot-${s} rounded-md px-2 py-0.5 text-[11px] font-medium`}
        >
          {SLOT_META[s].label}
        </span>
      ))}
    </div>
  )
}

export function HourPills({ hours }: { hours: DayHours | null | undefined }) {
  if (!hours || (!hours.flexible && hours.ranges.length === 0)) {
    return <span className="text-xs text-muted">Niet vrij</span>
  }
  if (hours.flexible) {
    return (
      <span className="slot-flexibel rounded-md px-2 py-0.5 text-[11px] font-medium">
        Flexibel · hele dag
      </span>
    )
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {hours.ranges.map((r) => (
        <span
          key={formatRange(r)}
          className="rounded-md bg-terra/30 px-2 py-0.5 text-[11px] font-semibold text-ink"
        >
          {formatRange(r)}
        </span>
      ))}
    </div>
  )
}

export function JobWhen({
  date,
  startTime,
  endTime,
  slots,
}: {
  date: string
  startTime?: string
  endTime?: string
  slots: Slot[]
}) {
  const when =
    startTime && endTime
      ? `${formatDateLong(date)} · ${startTime}–${endTime === '24:00' ? '24:00' : endTime}`
      : formatDate(date)
  return (
    <p className="mt-0.5 text-sm text-muted">
      {when}
      {!(startTime && endTime) && (
        <span className="ml-2 inline-block align-middle">
          <SlotPills slots={slots} />
        </span>
      )}
    </p>
  )
}

export function ContractBadge({ kind }: { kind: ContractKind }) {
  return (
    <span className="rounded-md bg-paper px-2 py-0.5 text-[11px] font-medium text-muted">
      {CONTRACT_META[kind]?.label ?? 'Flexi'}
    </span>
  )
}

export function BelgianChecklist({ kind }: { kind: ContractKind }) {
  return (
    <div className="rounded-xl border border-line bg-paper px-4 py-3 text-sm leading-relaxed text-muted">
      <div className="font-semibold text-ink">Checklist voor deze shift</div>
      <ul className="mt-2 space-y-1">
        <li>
          <span className="font-medium text-ink">{CONTRACT_META[kind].label}.</span> {CONTRACT_META[kind].hint}
        </li>
        <li>
          <span className="font-medium text-ink">Dimona</span> geeft de zaak aan — jij hoeft dat niet zelf te doen.
        </li>
        <li>
          Het uurloon op FlexiShift is ter info. Loonfiches lopen via de zaak of het sociaal secretariaat.
        </li>
      </ul>
    </div>
  )
}

export function PingBanner({
  title,
  text,
  onClick,
}: {
  title: string
  text: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-24 left-4 right-4 z-40 rounded-2xl border border-terra/40 bg-ink p-4 text-left text-cream shadow-lg md:bottom-8 md:left-auto md:right-8 md:w-[380px]"
    >
      <div className="text-[11px] font-semibold uppercase tracking-wide text-terra">{title}</div>
      <p className="mt-1 text-sm font-medium leading-relaxed">{text}</p>
      <div className="mt-2 text-[11px] font-semibold text-terra">Open inbox →</div>
    </button>
  )
}

export function MiniMap({ workplace, height = 180 }: { workplace: Workplace; height?: number }) {
  const wp = ensureWorkplace({ city: workplace.city, workplace })
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-line bg-paper"
      style={{ height }}
    >
      <iframe
        title={`Kaart van ${workplaceLine(wp)}`}
        src={osmEmbedUrl(wp.lat, wp.lng)}
        className="h-full w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  )
}

export function WorkplaceCard({ workplace }: { workplace: Workplace }) {
  const wp = ensureWorkplace({ city: workplace.city, workplace })
  return (
    <div className={`${cardClass} overflow-hidden`}>
      <MiniMap workplace={wp} height={176} />
      <div className="space-y-3 p-4">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
            <Icon name="pin" className="h-3.5 w-3.5 text-terra" />
            Werkplek
          </div>
          <p className="mt-1 font-medium">{wp.address}</p>
          <p className="text-sm text-muted">
            {wp.postal} {wp.city}
          </p>
        </div>
        {wp.access && (
          <p className="text-sm leading-relaxed text-muted">
            <span className="font-medium text-ink">Hoe geraak je er · </span>
            {wp.access}
          </p>
        )}
        {wp.parking && (
          <p className="text-sm leading-relaxed text-muted">
            <span className="font-medium text-ink">Parking · </span>
            {wp.parking}
          </p>
        )}
        {wp.contactOnSite && (
          <p className="text-sm leading-relaxed text-muted">
            <span className="font-medium text-ink">Ter plaatse · </span>
            {wp.contactOnSite}
          </p>
        )}
        {wp.notes && (
          <p className="text-sm leading-relaxed text-muted">
            <span className="font-medium text-ink">Let op · </span>
            {wp.notes}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <a
            href={googleMapsDirUrl(wp)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white"
          >
            Route Google Maps
          </a>
          <a
            href={appleMapsDirUrl(wp)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-semibold"
          >
            Route Apple Kaarten
          </a>
          <a
            href={osmOpenUrl(wp)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink underline decoration-terra decoration-2 underline-offset-4"
          >
            OpenStreetMap
            <Icon name="arrow" className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  )
}

export function JobDetail({
  job,
  applied,
  onApply,
  onClose,
}: {
  job: Job & { score?: number; reasons?: string[]; travel?: string }
  applied?: boolean
  onApply?: (extras: ApplyExtras) => void
  onClose: () => void
}) {
  const wp = ensureWorkplace(job)
  const [arriveBy, setArriveBy] = useState(job.startTime || '18:00')
  const [transport, setTransport] = useState<Transport>('fiets')
  const [question, setQuestion] = useState('')
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const kind = job.contractKind ?? 'flexi'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-detail-title"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-line bg-cream shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-line bg-cream/95 px-5 py-4 backdrop-blur">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="job-detail-title" className="text-lg font-semibold tracking-tight">
                {job.title}
              </h2>
              {job.urgent && (
                <span className="badge-spoed rounded-md px-2 py-0.5 text-[11px] font-medium">spoed</span>
              )}
              <ContractBadge kind={kind} />
            </div>
            <p className="mt-0.5 text-sm text-muted">
              {job.company} · €{job.hourlyRate}/uur
              {job.travel ? ` · ${job.travel}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-cream hover:bg-paper"
            aria-label="Sluiten"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-5 p-5">
          <JobWhen date={job.date} startTime={job.startTime} endTime={job.endTime} slots={job.slots} />
          <p className="text-sm leading-relaxed text-muted">{job.description}</p>
          <p className="text-xs leading-relaxed text-muted">{CONTRACT_META[kind].hint}</p>
          <BelgianChecklist kind={kind} />
          {job.reasons && job.reasons.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {job.reasons.map((r) => (
                <span key={r} className="rounded-md bg-terra/25 px-2 py-0.5 text-[11px] font-medium">
                  {r}
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {job.skills.map((s) => (
              <span key={s} className="rounded-md bg-paper px-2 py-0.5 text-[11px] font-medium text-muted">
                {s}
              </span>
            ))}
          </div>
          <WorkplaceCard workplace={wp} />
          {onApply && (
            <form
              className="space-y-3 rounded-xl border border-line bg-paper p-4"
              onSubmit={(e) => {
                e.preventDefault()
                onApply({
                  arriveBy,
                  transport,
                  question: question.trim() || undefined,
                })
                onClose()
              }}
            >
              <div className="text-sm font-semibold">Kort doorgeven</div>
              <Field label="Ik ben er om">
                <input
                  type="time"
                  className={inputClass}
                  value={arriveBy}
                  onChange={(e) => setArriveBy(e.target.value)}
                />
              </Field>
              <div>
                <div className="mb-1.5 text-sm font-medium">Ik kom met</div>
                <div className="flex flex-wrap gap-2">
                  {TRANSPORTS.map((t) => (
                    <Chip key={t.id} active={transport === t.id} onClick={() => setTransport(t.id)}>
                      {t.label}
                    </Chip>
                  ))}
                </div>
              </div>
              <Field label="Vraag aan de zaak (optioneel)">
                <input
                  className={inputClass}
                  placeholder="Waar meld ik me?"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                />
              </Field>
              <PrimaryButton type="submit" className="w-full">
                {applied ? 'Al gesolliciteerd' : 'Verstuur sollicitatie'}
              </PrimaryButton>
            </form>
          )}
          {applied && !onApply && (
            <div className="rounded-lg bg-paper px-4 py-3 text-center text-sm font-medium text-muted">
              Al gesolliciteerd
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function ShiftDetail({
  request,
  workplace,
  company,
  onClose,
  earnings,
  role,
  onOnTheWay,
  onCancel,
  onFeedback,
}: {
  request: WorkRequest
  workplace: Workplace
  company: string
  onClose: () => void
  earnings?: { hours: number; rate: number; pay: number; past?: boolean }
  role?: Role
  onOnTheWay?: () => void
  onCancel?: (reason: string) => void
  onFeedback?: (fb: ShiftFeedback) => void
}) {
  const count = shiftCountdown(request.date, request.startTime, request.endTime)
  const [reason, setReason] = useState('')
  const [askCancel, setAskCancel] = useState(false)
  const cancelled = request.status === 'cancelled'
  const live = request.status === 'accepted' && !count.past
  const done = request.status === 'accepted' && count.past
  const fb = role === 'employer' ? request.employerFeedback : request.seekerFeedback
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-line bg-cream shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-line bg-cream/95 px-5 py-4 backdrop-blur">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Jouw shift</div>
            <h2 className="mt-0.5 text-lg font-semibold tracking-tight">{request.title}</h2>
            <p className="text-sm text-muted">
              {company} · {cancelled ? 'Geannuleerd' : count.label}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-cream hover:bg-paper"
            aria-label="Sluiten"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-5 p-5">
          {cancelled && (
            <div className="rounded-xl bg-zinc-100 px-4 py-3 text-sm text-muted">
              <span className="font-medium text-ink">Geannuleerd</span>
              {request.cancelledBy ? ` door de ${request.cancelledBy === 'seeker' ? 'werknemer' : 'zaak'}` : ''}.
              {request.cancelReason ? ` ${request.cancelReason}` : ''}
            </div>
          )}
          {count.soon && live && (
            <div className="rounded-xl bg-terra/25 px-4 py-3 text-sm">
              <span className="font-semibold">Herinnering · {count.label}.</span> Check kleding, adres en bij wie je je meldt.
            </div>
          )}
          <JobWhen
            date={request.date}
            startTime={request.startTime}
            endTime={request.endTime}
            slots={request.slots}
          />
          {earnings && !cancelled && (
            <div className="rounded-xl bg-emerald-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                {earnings.past ? 'Verdiend' : 'Verwacht loon'}
              </div>
              <div className="mt-1 text-lg font-semibold tracking-tight text-ink">
                {formatEuro(earnings.pay)}
              </div>
              <p className="mt-0.5 text-sm text-muted">
                {formatHours(earnings.hours)} · €{earnings.rate}/u
              </p>
            </div>
          )}
          {request.extras && (
            <p className="text-sm text-muted">
              Jij komt om {request.extras.arriveBy} met de {request.extras.transport}
              {request.extras.question ? ` · “${request.extras.question}”` : ''}
            </p>
          )}
          {request.onTheWayAt && live && (
            <p className="text-sm font-medium text-ink">Onderweg gemeld.</p>
          )}
          {live && (workplace.notes || workplace.access || workplace.contactOnSite) && (
            <div className="rounded-xl border border-line bg-paper px-4 py-3 text-sm leading-relaxed">
              <div className="font-semibold text-ink">Voor je vertrekt</div>
              {workplace.notes && <p className="mt-1.5 text-muted">{workplace.notes}</p>}
              {workplace.contactOnSite && (
                <p className="mt-1.5 text-muted">
                  <span className="font-medium text-ink">Meld je bij · </span>
                  {workplace.contactOnSite}
                </p>
              )}
              {workplace.access && (
                <p className="mt-1.5 text-muted">
                  <span className="font-medium text-ink">Toegang · </span>
                  {workplace.access}
                </p>
              )}
            </div>
          )}
          <WorkplaceCard workplace={workplace} />
          {live && (
            <div className="flex flex-col gap-2">
              {onOnTheWay && !request.onTheWayAt && (
                <PrimaryButton onClick={onOnTheWay} className="w-full">
                  Ik ben onderweg
                </PrimaryButton>
              )}
              {onCancel && !askCancel && (
                <GhostButton onClick={() => setAskCancel(true)} className="w-full">
                  Shift annuleren
                </GhostButton>
              )}
              {onCancel && askCancel && (
                <div className="space-y-2 rounded-xl border border-line p-3">
                  <Field label="Korte reden (geen straf, alleen ter info)">
                    <input
                      className={inputClass}
                      value={reason}
                      placeholder="Ziek, trein gemist, te weinig volk, …"
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </Field>
                  <div className="flex gap-2">
                    <PrimaryButton onClick={() => onCancel(reason)} className="!py-2.5">
                      Bevestig annuleren
                    </PrimaryButton>
                    <GhostButton onClick={() => setAskCancel(false)} className="!py-2.5">
                      Terug
                    </GhostButton>
                  </div>
                </div>
              )}
            </div>
          )}
          {done && onFeedback && (
            <div className="space-y-3 rounded-xl border border-line p-4">
              <div className="text-sm font-semibold">Na de shift — geen score, wel nuttig</div>
              <YesNo
                label={role === 'employer' ? 'Was de persoon op tijd en aanspreekbaar?' : 'Was de briefing duidelijk?'}
                value={fb?.briefingOk}
                onChange={(v) => onFeedback({ ...fb, briefingOk: v })}
              />
              <YesNo
                label="Klopte het adres / de werkplek?"
                value={fb?.addressOk}
                onChange={(v) => onFeedback({ ...fb, addressOk: v })}
              />
              <YesNo
                label={role === 'employer' ? 'Wil je deze persoon opnieuw vragen?' : 'Wil je hier opnieuw werken?'}
                value={fb?.wantAgain}
                onChange={(v) => onFeedback({ ...fb, wantAgain: v })}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function YesNo({
  label,
  value,
  onChange,
}: {
  label: string
  value?: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div>
      <div className="text-sm text-ink">{label}</div>
      <div className="mt-1.5 flex gap-2">
        <Chip active={value === true} onClick={() => onChange(true)}>
          Ja
        </Chip>
        <Chip active={value === false} onClick={() => onChange(false)}>
          Nee
        </Chip>
      </div>
    </div>
  )
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean
  onClick?: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
        active
          ? 'bg-ink text-cream'
          : 'border border-line bg-cream text-ink hover:bg-zinc-50'
      }`}
    >
      {children}
    </button>
  )
}

export function PrimaryButton({
  children,
  onClick,
  type = 'button',
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  className?: string
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-terra px-5 py-3 text-sm font-bold text-ink shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-terra-deep ${className}`}
    >
      {children}
    </button>
  )
}

export function GhostButton({
  children,
  onClick,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-cream px-5 py-3 text-sm font-semibold text-ink transition-all duration-150 hover:-translate-y-0.5 hover:bg-zinc-50 ${className}`}
    >
      {children}
    </button>
  )
}

export function DarkButton({
  children,
  onClick,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-5 py-3 text-sm font-bold text-white transition-all duration-150 hover:-translate-y-0.5 hover:bg-zinc-800 ${className}`}
    >
      {children}
    </button>
  )
}

export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  )
}

export function toggleSlot(current: Slot[], slot: Slot): Slot[] {
  if (slot === 'flexibel') {
    return current.includes('flexibel') ? [] : ['flexibel']
  }
  const withoutFlex = current.filter((s) => s !== 'flexibel')
  return withoutFlex.includes(slot)
    ? withoutFlex.filter((s) => s !== slot)
    : [...withoutFlex, slot]
}

export function SlotToggle({
  value,
  onChange,
}: {
  value: Slot[]
  onChange: (next: Slot[]) => void
}) {
  const allDay: Slot[] = ['ochtend', 'namiddag', 'avond']
  const hasAll = allDay.every((s) => value.includes(s)) && !value.includes('flexibel')

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(['ochtend', 'namiddag', 'avond', 'flexibel'] as Slot[]).map((slot) => {
          const on = value.includes(slot)
          return (
            <button
              key={slot}
              type="button"
              onClick={() => onChange(toggleSlot(value, slot))}
              className={`rounded-xl border px-3 py-2.5 text-left transition-all duration-150 ${
                on
                  ? `slot-${slot} border-transparent shadow-sm`
                  : 'border-line bg-cream text-muted hover:border-zinc-300 hover:bg-paper'
              }`}
            >
              <div className="text-sm font-medium">{SLOT_META[slot].label}</div>
              <div className={`text-[11px] ${on ? 'opacity-80' : ''}`}>{SLOT_META[slot].time}</div>
            </button>
          )
        })}
      </div>
      <button
        type="button"
        onClick={() => onChange(hasAll ? [] : allDay)}
        className={`rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors duration-150 ${
          hasAll
            ? 'border-ink bg-ink text-cream'
            : 'border-line bg-cream text-ink hover:bg-paper'
        }`}
      >
        Hele dag vrij
        <span className={`ml-2 text-[11px] font-normal ${hasAll ? 'text-cream/70' : 'text-muted'}`}>
          ochtend + namiddag + avond
        </span>
      </button>
    </div>
  )
}

export function WeekEditor({
  recurring,
  onChange,
}: {
  recurring: Record<Weekday, Slot[]>
  onChange: (day: Weekday, slots: Slot[]) => void
}) {
  const days: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
      {days.map((day) => (
        <div key={day} className={`${cardClass} p-3.5`}>
          <div className="mb-3 text-sm font-semibold">{WEEKDAY_META[day].long}</div>
          <div className="flex flex-col gap-1.5">
            {(['ochtend', 'namiddag', 'avond', 'flexibel'] as Slot[]).map((slot) => {
              const on = recurring[day].includes(slot)
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => onChange(day, toggleSlot(recurring[day], slot))}
                  className={`rounded-lg px-2 py-1.5 text-left text-xs font-medium transition-colors duration-150 ${
                    on ? `slot-${slot}` : 'bg-paper text-muted hover:bg-zinc-100'
                  }`}
                >
                  {SLOT_META[slot].label}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() =>
                onChange(
                  day,
                  ['ochtend', 'namiddag', 'avond'].every((s) =>
                    recurring[day].includes(s as Slot),
                  )
                    ? []
                    : ['ochtend', 'namiddag', 'avond'],
                )
              }
              className="mt-1 text-left text-[11px] font-medium text-terra hover:underline"
            >
              Hele dag
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export function PeriodEditor({
  seeker,
  dates,
  onSet,
  onReset,
}: {
  seeker: Seeker
  dates: string[]
  onSet: (date: string, slots: Slot[]) => void
  onReset: (date: string) => void
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {dates.map((date) => {
        const slots = slotsOnDate(seeker, date)
        const overridden = Object.prototype.hasOwnProperty.call(seeker.overrides, date)
        const day = weekdayFromIso(date)
        return (
          <div
            key={date}
            className={`min-w-[148px] rounded-xl border bg-cream p-3.5 shadow-sm ${
              overridden ? 'border-terra/40' : 'border-line'
            }`}
          >
            <div className="mb-3">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted">
                {WEEKDAY_META[day].long}
              </div>
              <div className="text-sm font-semibold leading-tight">{formatDate(date)}</div>
            </div>
            <div className="flex flex-col gap-1.5">
              {(['ochtend', 'namiddag', 'avond', 'flexibel'] as Slot[]).map((slot) => {
                const on = slots.includes(slot)
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => onSet(date, toggleSlot(slots, slot))}
                    className={`rounded-lg px-2 py-1.5 text-left text-xs font-medium transition-colors duration-150 ${
                      on ? `slot-${slot}` : 'bg-paper text-muted hover:bg-zinc-100'
                    }`}
                  >
                    {SLOT_META[slot].label}
                  </button>
                )
              })}
            </div>
            {overridden && (
              <button
                type="button"
                onClick={() => onReset(date)}
                className="mt-2 text-[11px] font-medium text-muted transition-colors hover:text-ink"
              >
                Terug naar vaste week
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function Icon({
  name,
  className = 'h-5 w-5',
}: {
  name:
    | 'home'
    | 'cal'
    | 'brief'
    | 'user'
    | 'inbox'
    | 'search'
    | 'plus'
    | 'bolt'
    | 'pin'
    | 'clock'
    | 'check'
    | 'x'
    | 'arrow'
    | 'chevron'
    | 'star'
  className?: string
}) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    viewBox: '0 0 24 24',
  }
  switch (name) {
    case 'home':
      return (
        <svg {...common}>
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
        </svg>
      )
    case 'cal':
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3v4M16 3v4M4 10h16" />
        </svg>
      )
    case 'brief':
      return (
        <svg {...common}>
          <path d="M8 7V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1" />
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M3 12h18" />
        </svg>
      )
    case 'user':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5 19c1.4-3 4-4.5 7-4.5S17.6 16 19 19" />
        </svg>
      )
    case 'inbox':
      return (
        <svg {...common}>
          <path d="M4 13 6.5 5h11L20 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
          <path d="M4 13h4l2 3h4l2-3h4" />
        </svg>
      )
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      )
    case 'plus':
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      )
    case 'bolt':
      return (
        <svg {...common}>
          <path d="M13 3 5 14h7l-1 7 9-12h-7z" />
        </svg>
      )
    case 'pin':
      return (
        <svg {...common}>
          <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
          <circle cx="12" cy="10" r="2.2" />
        </svg>
      )
    case 'clock':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v5l3 2" />
        </svg>
      )
    case 'check':
      return (
        <svg {...common}>
          <path d="m5 12 5 5 9-10" />
        </svg>
      )
    case 'x':
      return (
        <svg {...common}>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      )
    case 'arrow':
      return (
        <svg {...common}>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      )
    case 'chevron':
      return (
        <svg {...common}>
          <path d="m9 6 6 6-6 6" />
        </svg>
      )
    case 'star':
      return (
        <svg {...common}>
          <path d="M12 3.6 14.5 9l6 .7-4.4 4 1.2 5.8L12 16.8 6.7 19.5l1.2-5.8L3.5 9.7l6-.7z" />
        </svg>
      )
  }
}
