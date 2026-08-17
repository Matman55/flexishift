import { useState, type ReactNode } from 'react'
import {
  Avatar,
  Chip,
  ContractBadge,
  Field,
  GhostButton,
  Icon,
  JobDetail,
  MatchRing,
  PingBanner,
  PrimaryButton,
  ShiftDetail,
  SlotPills,
  WeekEditor,
  JobWhen,
  cardClass,
  inputClass,
} from './components'
import { AvailabilityCalendar, type CalendarShift } from './AvailabilityCalendar'
import { calendarDates } from './time'
import {
  CITIES,
  LANGUAGES,
  SECTORS,
  SKILLS,
  ensureWorkplace,
  formatDateLong,
  isoDate,
  shiftCountdown,
  workplaceFromCity,
  workplaceLine,
} from './constants'
import { Logo } from './Landing'
import { EmptyMascot, Guide, Mascot } from './Mascot'
import { jobsForSeeker, bookedRangesForSeeker } from './match'
import { useStore } from './store'
import type { ApplyExtras, DayHours, Job, Seeker, Slot, Weekday, WorkRequest } from './types'

type Tab = 'home' | 'cal' | 'jobs' | 'inbox' | 'profile'

export function SeekerApp() {
  const store = useStore()
  const seeker = store.seekers.find((s) => s.id === store.session?.seekerId)
  const [tab, setTab] = useState<Tab>('home')
  const [toast, setToast] = useState<string | null>(null)

  if (!seeker) return null

  const pingToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2600)
  }

  if (!seeker.onboardingDone) {
    return <Onboarding seeker={seeker} />
  }

  const matches = jobsForSeeker(seeker, store.jobs, bookedRangesForSeeker(store.requests, seeker.id))
  const inbox = store.requests.filter((r) => r.seekerId === seeker.id)
  const pending = inbox.filter((r) => r.status === 'pending' && r.from === 'employer').length
  const shifts = inbox
    .filter((r) => r.status === 'accepted')
    .sort((a, b) => `${a.date}${a.startTime ?? ''}`.localeCompare(`${b.date}${b.startTime ?? ''}`))
  const ping = inbox.find(
    (r) =>
      !r.readAt &&
      ((r.from === 'employer' && r.status === 'pending') || r.status === 'accepted'),
  )

  const sendApply = (job: Job, extras: ApplyExtras) => {
    const q = extras.question ? ` ${extras.question}` : ''
    store.addRequest({
      jobId: job.id,
      employerId: job.employerId,
      seekerId: seeker.id,
      from: 'seeker',
      message: `Hallo, ik ben ${seeker.name}. Ik ben er om ${extras.arriveBy} met de ${extras.transport}.${q}`,
      date: job.date,
      slots: job.slots,
      startTime: job.startTime,
      endTime: job.endTime,
      title: job.title,
      city: job.city,
      extras,
    })
    pingToast('Sollicitatie verstuurd')
  }

  return (
    <Shell
      tab={tab}
      setTab={(t) => {
        if (t === 'inbox') store.markRequestsRead('seeker', seeker.id)
        setTab(t)
      }}
      pending={pending}
      onLogout={store.logout}
      toast={toast}
      banner={
        ping && tab !== 'inbox' ? (
          <PingBanner
            title={ping.status === 'accepted' ? 'Shift bevestigd' : 'Nieuwe aanvraag'}
            text={
              ping.status === 'accepted'
                ? `${ping.title} · ${formatDateLong(ping.date)} ${ping.startTime ?? ''}`.trim()
                : `${store.employers.find((e) => e.id === ping.employerId)?.company ?? 'Een zaak'} zoekt je ${formatDateLong(ping.date)}${ping.startTime ? ` ${ping.startTime}–${ping.endTime}` : ''}`
            }
            onClick={() => {
              store.markRequestsRead('seeker', seeker.id)
              setTab('inbox')
            }}
          />
        ) : null
      }
    >
      {tab === 'home' && (
        <Home
          seeker={seeker}
          matches={matches}
          pending={pending}
          shifts={shifts}
          onOpenJobs={() => setTab('jobs')}
          onOpenCal={() => setTab('cal')}
          onApply={sendApply}
        />
      )}
      {tab === 'cal' && (
        <CalendarPane
          seeker={seeker}
          shifts={shifts.map((r) => ({
            id: r.id,
            date: r.date,
            title: r.title,
            company: store.employers.find((e) => e.id === r.employerId)?.company ?? r.city,
            startTime: r.startTime,
            endTime: r.endTime,
          }))}
          onRecurring={(day, slots) => store.setRecurring(seeker.id, day, slots)}
          onHours={(date, hours) => store.setDayHours(seeker.id, date, hours)}
          onApplyWeek={() => store.applyRecurringHours(seeker.id, calendarDates(6).filter((d) => d >= isoDate(0)))}
          onLastMinute={(v) => store.updateSeeker(seeker.id, { lastMinute: v })}
        />
      )}
      {tab === 'jobs' && (
        <JobsPane
          seeker={seeker}
          jobs={matches}
          requested={new Set(inbox.map((r) => r.jobId).filter(Boolean) as string[])}
          onApply={sendApply}
        />
      )}
      {tab === 'inbox' && (
        <InboxPane
          seeker={seeker}
          onStatus={(id, status) => {
            store.setRequestStatus(id, status)
            pingToast(status === 'accepted' ? 'Shift bevestigd — hij staat in je kalender' : 'Aanvraag afgewezen')
            if (status === 'accepted') setTab('cal')
          }}
        />
      )}
      {tab === 'profile' && <ProfilePane seeker={seeker} />}
    </Shell>
  )
}

function Shell({
  tab,
  setTab,
  pending,
  onLogout,
  toast,
  banner,
  children,
}: {
  tab: Tab
  setTab: (t: Tab) => void
  pending: number
  onLogout: () => void
  toast: string | null
  banner?: ReactNode
  children: ReactNode
}) {
  const items: { id: Tab; label: string; icon: 'home' | 'cal' | 'brief' | 'inbox' | 'user' }[] = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'cal', label: 'Kalender', icon: 'cal' },
    { id: 'jobs', label: 'Jobs', icon: 'brief' },
    { id: 'inbox', label: 'Inbox', icon: 'inbox' },
    { id: 'profile', label: 'Profiel', icon: 'user' },
  ]
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[232px_1fr]">
      <aside className="hidden border-r border-line bg-cream md:flex md:flex-col md:px-4 md:py-6">
        <Logo compact />
        <nav className="mt-8 flex flex-1 flex-col gap-0.5">
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => setTab(it.id)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                tab === it.id ? 'bg-terra text-ink' : 'text-muted hover:bg-zinc-50 hover:text-ink'
              }`}
            >
              <Icon name={it.icon} />
              {it.label}
              {it.id === 'inbox' && pending > 0 && (
                <span className="badge-accent ml-auto rounded-md px-1.5 py-0.5 text-[11px]">
                  {pending}
                </span>
              )}
            </button>
          ))}
        </nav>
        <button type="button" onClick={onLogout} className="px-3 text-left text-sm font-medium text-muted transition-colors hover:text-ink">
          Terug naar start
        </button>
      </aside>
      <div className="pb-36 md:pb-24">
        <header className="flex items-center justify-between border-b border-line bg-cream px-6 py-4 md:hidden">
          <Logo compact />
          <button type="button" onClick={onLogout} className="text-sm font-medium text-muted">
            Uit
          </button>
        </header>
        <main className="mx-auto max-w-3xl px-6 py-8 md:max-w-4xl md:px-10 md:py-10">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-cream/95 px-1 py-2 backdrop-blur md:hidden">
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            onClick={() => setTab(it.id)}
            className={`relative flex flex-col items-center gap-0.5 text-[11px] font-semibold ${
              tab === it.id ? 'text-terra' : 'text-muted'
            }`}
          >
            <Icon name={it.icon} />
            {it.label}
            {it.id === 'inbox' && pending > 0 && (
              <span className="absolute right-4 top-0 h-2 w-2 rounded-full bg-terra" />
            )}
          </button>
        ))}
      </nav>
      {banner}
      {toast && (
        <div className="fixed bottom-24 left-1/2 z-30 -translate-x-1/2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-cream shadow-md md:bottom-8">
          {toast}
        </div>
      )}
    </div>
  )
}

function Home({
  seeker,
  matches,
  pending,
  shifts,
  onOpenJobs,
  onOpenCal,
  onApply,
}: {
  seeker: Seeker
  matches: Array<Job & { score: number; reasons?: string[]; travel?: string }>
  pending: number
  shifts: WorkRequest[]
  onOpenJobs: () => void
  onOpenCal: () => void
  onApply: (job: Job, extras: ApplyExtras) => void
}) {
  const store = useStore()
  const [openShift, setOpenShift] = useState<WorkRequest | null>(null)
  const upcoming = shifts.filter((s) => !shiftCountdown(s.date, s.startTime, s.endTime).past)
  const urgent = matches.filter((j) => j.urgent)
  const shiftWp = (r: WorkRequest) => {
    const job = r.jobId ? store.jobs.find((j) => j.id === r.jobId) : undefined
    if (job) return ensureWorkplace(job)
    const emp = store.employers.find((e) => e.id === r.employerId)
    return emp?.workplace ?? workplaceFromCity(r.city)
  }
  return (
    <div>
      <Guide
        pose="search"
        title="Jobs die bij jou passen"
        text="Ik toon hier alleen opdrachten waarvan de uren overlappen met jouw kalender. Tik er één aan als hij past."
      />
      <p className="text-sm font-medium text-muted">Hallo {seeker.name.split(' ')[0]}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">
        {matches.length} jobs passen bij jouw shiften
      </h1>
      <div className="mt-8 grid grid-cols-3 gap-4">
        <Stat n={upcoming.length} l="shiften" />
        <Stat n={pending} l="aanvragen" />
        <Stat n={seeker.jobsDone} l="gedaan" />
      </div>
      {upcoming.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">Jouw shiften</h2>
          <div className="mt-4 space-y-3">
            {upcoming.map((s) => {
              const c = shiftCountdown(s.date, s.startTime, s.endTime)
              const emp = store.employers.find((e) => e.id === s.employerId)
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setOpenShift(s)}
                  className={`${cardClass} w-full p-5 text-left transition-colors hover:border-terra/40`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium">{s.title}</h3>
                      <p className="mt-0.5 text-sm text-muted">
                        {emp?.company} · {formatDateLong(s.date)}
                        {s.startTime ? ` · ${s.startTime}–${s.endTime}` : ''}
                      </p>
                    </div>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${c.urgent ? 'badge-spoed' : 'badge-ok'}`}
                    >
                      {c.label}
                    </span>
                  </div>
                  <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-muted">
                    <Icon name="pin" className="h-3.5 w-3.5 text-terra" />
                    {workplaceLine(shiftWp(s))}
                  </p>
                </button>
              )
            })}
          </div>
        </section>
      )}
      <div className="mt-4 flex gap-2">
        <GhostButton onClick={onOpenCal} className="!px-4 !py-2">
          Open kalender
        </GhostButton>
        <GhostButton onClick={onOpenJobs} className="!px-4 !py-2">
          Alle jobs
        </GhostButton>
      </div>

      {urgent.length > 0 && (
        <section className="mt-10">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Icon name="bolt" className="text-terra" /> Last-minute
          </h2>
          <div className="mt-4 space-y-3">
            {urgent.slice(0, 3).map((j) => (
              <JobCard key={j.id} job={j} onApply={(extras) => onApply(j, extras)} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">Beste matches</h2>
        <div className="mt-4 space-y-3">
          {matches.slice(0, 4).map((j) => (
            <JobCard key={j.id} job={j} onApply={(extras) => onApply(j, extras)} />
          ))}
        </div>
      </section>
      {openShift && (
        <ShiftDetail
          request={openShift}
          workplace={shiftWp(openShift)}
          company={store.employers.find((e) => e.id === openShift.employerId)?.company ?? ''}
          onClose={() => setOpenShift(null)}
        />
      )}
    </div>
  )
}

function Stat({ n, l }: { n: number; l: string }) {
  return (
    <div className={`${cardClass} p-5`}>
      <div className="text-2xl font-semibold tracking-tight">{n}</div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">{l}</div>
    </div>
  )
}

function JobCard({
  job,
  onApply,
  applied,
}: {
  job: Job & { score?: number; reasons?: string[]; travel?: string }
  onApply?: (extras: ApplyExtras) => void
  applied?: boolean
}) {
  const [open, setOpen] = useState(false)
  const wp = ensureWorkplace(job)
  return (
    <>
      <article
        className={`${cardClass} cursor-pointer p-5 transition-colors duration-150 hover:border-terra/40 hover:bg-paper/60`}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen(true)
          }
        }}
        role="button"
        tabIndex={0}
      >
        <div className="flex items-start gap-3">
          {job.score != null && <MatchRing score={job.score} />}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-medium">{job.title}</h3>
              {job.urgent && (
                <span className="badge-spoed rounded-md px-2 py-0.5 text-[11px] font-medium">
                  spoed
                </span>
              )}
              <ContractBadge kind={job.contractKind ?? 'flexi'} />
            </div>
            <p className="mt-0.5 text-sm text-muted">
              {job.company} · {job.travel ?? job.city}
            </p>
            <JobWhen date={job.date} startTime={job.startTime} endTime={job.endTime} slots={job.slots} />
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold tracking-tight">€{job.hourlyRate}</div>
            <div className="text-[11px] text-muted">/ uur</div>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted">{job.description}</p>
        {job.reasons && job.reasons.length > 0 && (
          <p className="mt-2 text-xs text-muted">{job.reasons.slice(0, 3).join(' · ')}</p>
        )}
        <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-muted">
          <Icon name="pin" className="h-3.5 w-3.5 text-terra" />
          {workplaceLine(wp)}
          <span className="ml-auto text-[11px] font-semibold text-ink">Bekijk werkplek</span>
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {job.skills.map((s) => (
            <span key={s} className="rounded-md bg-paper px-2 py-0.5 text-[11px] font-medium text-muted">
              {s}
            </span>
          ))}
        </div>
        {onApply && (
          <div className="mt-4" onClick={(e) => e.stopPropagation()}>
            <PrimaryButton onClick={() => setOpen(true)} className="!py-2.5 w-full sm:w-auto">
              {applied ? 'Al gesolliciteerd' : 'Ik wil dit doen'}
            </PrimaryButton>
          </div>
        )}
      </article>
      {open && (
        <JobDetail job={job} applied={applied} onApply={onApply} onClose={() => setOpen(false)} />
      )}
    </>
  )
}

function CalendarPane({
  seeker,
  shifts,
  onRecurring,
  onHours,
  onApplyWeek,
  onLastMinute,
}: {
  seeker: Seeker
  shifts: CalendarShift[]
  onRecurring: (day: Weekday, slots: Slot[]) => void
  onHours: (date: string, hours: DayHours | null) => void
  onApplyWeek: () => void
  onLastMinute: (v: boolean) => void
}) {
  return (
    <div>
      <Guide
        pose="point"
        title="Jouw week in één oogopslag"
        text="Geel is vrij, zwart is een bevestigde job. Tik op een dag om uren te zetten of een shift te bekijken."
      />
      <h1 className="text-3xl font-semibold tracking-tight">Jouw kalender</h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
        Zie in één keer wanneer je nog vrij bent en wat al gepland staat. Klik op een dag om
        uren aan te passen of een bevestigde shift te bekijken.
      </p>
      <label className={`${cardClass} mt-8 flex items-center justify-between p-5`}>
        <div>
          <div className="font-medium">Last-minute beschikbaar</div>
          <div className="mt-0.5 text-sm text-muted">Werkgevers met spoed zien jou extra hoog</div>
        </div>
        <button
          type="button"
          onClick={() => onLastMinute(!seeker.lastMinute)}
          className={`h-7 w-11 rounded-full p-0.5 transition-colors duration-150 ${seeker.lastMinute ? 'bg-terra' : 'bg-line'}`}
        >
          <span
            className={`block h-6 w-6 rounded-full bg-white shadow-sm transition ${seeker.lastMinute ? 'translate-x-4' : ''}`}
          />
        </button>
      </label>

      <h2 className="mt-10 text-lg font-semibold tracking-tight">Overzicht</h2>
      <p className="mb-4 mt-1 text-sm text-muted">
        Gele dagen zijn vrij. Zwarte dagen hebben een bevestigde job.
      </p>
      <AvailabilityCalendar
        seeker={seeker}
        shifts={shifts}
        onChange={onHours}
        onApplyWeek={onApplyWeek}
      />

      <h2 className="mt-10 text-lg font-semibold tracking-tight">Vaste week</h2>
      <p className="mb-4 mt-1 text-sm text-muted">
        Handig als je in shiften werkt. Daarna: “Vaste week toepassen” om die uren op de kalender te zetten. Per dag kun je nog finetunen.
      </p>
      <WeekEditor recurring={seeker.recurring} onChange={onRecurring} />
    </div>
  )
}

function JobsPane({
  seeker,
  jobs,
  requested,
  onApply,
}: {
  seeker: Seeker
  jobs: Array<Job & { score: number; reasons?: string[]; travel?: string }>
  requested: Set<string>
  onApply: (job: Job, extras: ApplyExtras) => void
}) {
  const [city, setCity] = useState('alle')
  const [onlyUrgent, setOnlyUrgent] = useState(false)
  const filtered = jobs.filter((j) => {
    if (city !== 'alle' && j.city !== city) return false
    if (onlyUrgent && !j.urgent) return false
    return true
  })
  const cities = ['alle', ...new Set(jobs.map((j) => j.city))]
  return (
    <div>
      <Guide
        pose="search"
        title="Opdrachten voor jou"
        text="Ik filter al op jouw kalender. Staat er niks? Zet extra uren open of kijk in een andere stad."
      />
      <h1 className="text-3xl font-semibold tracking-tight">Opdrachten voor jou</h1>
      <p className="mt-2 text-sm text-muted">
        Alleen jobs waarvan de uren overlappen met {seeker.name.split(' ')[0]}’s beschikbaarheid.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        {cities.map((c) => (
          <Chip key={c} active={city === c} onClick={() => setCity(c)}>
            {c === 'alle' ? 'Alle steden' : c}
          </Chip>
        ))}
        <Chip active={onlyUrgent} onClick={() => setOnlyUrgent(!onlyUrgent)}>
          Alleen spoed
        </Chip>
      </div>
      <div className="mt-5 space-y-3">
        {filtered.length === 0 && (
          <EmptyMascot
            pose="search"
            title="Nog geen match"
            text="Geen jobs in dit filter. Zet extra uren open of kijk in een andere stad — ik zoek opnieuw."
          />
        )}
        {filtered.map((j) => (
          <JobCard
            key={j.id}
            job={j}
            applied={requested.has(j.id)}
            onApply={requested.has(j.id) ? undefined : (extras) => onApply(j, extras)}
          />
        ))}
      </div>
    </div>
  )
}

function InboxPane({
  seeker,
  onStatus,
}: {
  seeker: Seeker
  onStatus: (id: string, status: 'accepted' | 'declined') => void
}) {
  const store = useStore()
  const items = store.requests.filter((r) => r.seekerId === seeker.id)
  const [openShift, setOpenShift] = useState<WorkRequest | null>(null)
  const wpFor = (r: WorkRequest) => {
    const job = r.jobId ? store.jobs.find((j) => j.id === r.jobId) : undefined
    if (job) return ensureWorkplace(job)
    const emp = store.employers.find((e) => e.id === r.employerId)
    return emp?.workplace ?? workplaceFromCity(r.city)
  }
  return (
    <div>
      <Guide
        pose="hint"
        title="Jouw inbox"
        text="Hier komen aanvragen van werkgevers. Jij beslist of je de shift doet."
      />
      <h1 className="text-3xl font-semibold tracking-tight">Inbox</h1>
      <div className="mt-6 space-y-3">
        {items.length === 0 && (
          <EmptyMascot
            pose="idle"
            title="Nog stil hier"
            text="Zodra een zaak je vraagt, zie je het hier. Ik geef je een seintje."
          />
        )}
        {items.map((r) => {
          const emp = store.employers.find((e) => e.id === r.employerId)
          const count = shiftCountdown(r.date, r.startTime, r.endTime)
          return (
            <article key={r.id} className={`${cardClass} p-5`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-medium text-muted">
                    {r.from === 'employer' ? 'Aanvraag van werkgever' : 'Jouw sollicitatie'}
                  </div>
                  <h3 className="mt-1 font-medium">{r.title}</h3>
                  <p className="text-sm text-muted">
                    {emp?.company} · {formatDateLong(r.date)} · {count.label}
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted">{r.message}</p>
              {r.extras && (
                <p className="mt-2 text-xs text-muted">
                  Aankomst {r.extras.arriveBy} · {r.extras.transport}
                  {r.extras.question ? ` · ${r.extras.question}` : ''}
                </p>
              )}
              <div className="mt-2">
                {r.startTime && r.endTime ? (
                  <span className="rounded-md bg-terra/30 px-2 py-0.5 text-[11px] font-semibold">
                    {r.startTime}–{r.endTime}
                  </span>
                ) : (
                  <SlotPills slots={r.slots} />
                )}
              </div>
              {r.status === 'pending' && r.from === 'employer' && (
                <div className="mt-4 flex gap-2">
                  <PrimaryButton onClick={() => onStatus(r.id, 'accepted')} className="!py-2.5">
                    Ik doe het
                  </PrimaryButton>
                  <GhostButton onClick={() => onStatus(r.id, 'declined')} className="!py-2.5">
                    Niet mogelijk
                  </GhostButton>
                </div>
              )}
              {r.status === 'accepted' && (
                <GhostButton onClick={() => setOpenShift(r)} className="mt-4 !py-2.5">
                  Open shiftkaart
                </GhostButton>
              )}
            </article>
          )
        })}
      </div>
      {openShift && (
        <ShiftDetail
          request={openShift}
          workplace={wpFor(openShift)}
          company={store.employers.find((e) => e.id === openShift.employerId)?.company ?? ''}
          onClose={() => setOpenShift(null)}
        />
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'badge-pending',
    accepted: 'badge-ok',
    declined: 'badge-muted',
  }
  const label: Record<string, string> = {
    pending: 'Open',
    accepted: 'Bevestigd',
    declined: 'Afgewezen',
  }
  return (
    <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${map[status]}`}>
      {label[status]}
    </span>
  )
}

function ProfilePane({ seeker }: { seeker: Seeker }) {
  const store = useStore()
  const [draft, setDraft] = useState(seeker)
  const save = () => {
    store.updateSeeker(seeker.id, { ...draft, onboardingDone: true })
  }
  return (
    <div>
      <Guide
        pose="idle"
        title="Jouw profiel"
        text="Vul skills, stad en een korte bio in. Hoe completer, hoe beter werkgevers je vinden."
      />
      <div className={`${cardClass} p-6`}>
        <div className="flex items-center gap-4">
          <Avatar name={draft.name} hue={draft.hue} size="lg" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{draft.name}</h1>
            <p className="mt-1 text-sm text-muted">
              ★ {draft.rating} · {draft.jobsDone} opdrachten
            </p>
          </div>
        </div>
      </div>
      <div className={`${cardClass} mt-4 space-y-5 p-6`}>
        <Field label="Korte bio">
          <textarea
            className={`${inputClass} min-h-[90px]`}
            value={draft.bio}
            onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
          />
        </Field>
        <Field label="Stad">
          <select
            className={inputClass}
            value={draft.city}
            onChange={(e) => setDraft({ ...draft, city: e.target.value })}
          >
            {CITIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Minimum uurloon (€)">
          <input
            type="number"
            className={inputClass}
            value={draft.hourlyRateMin}
            onChange={(e) => setDraft({ ...draft, hourlyRateMin: Number(e.target.value) })}
          />
        </Field>
        <ToggleRow
          label="Rijbewijs B"
          on={draft.hasLicense}
          onChange={(v) => setDraft({ ...draft, hasLicense: v })}
        />
        <ToggleRow
          label="Eigen vervoer"
          on={draft.hasTransport}
          onChange={(v) => setDraft({ ...draft, hasTransport: v })}
        />
        <div>
          <div className="mb-2 text-sm font-medium text-ink">Sectoren</div>
          <div className="flex flex-wrap gap-2">
            {SECTORS.map((s) => (
              <Chip
                key={s}
                active={draft.sectors.includes(s)}
                onClick={() =>
                  setDraft({
                    ...draft,
                    sectors: draft.sectors.includes(s)
                      ? draft.sectors.filter((x) => x !== s)
                      : [...draft.sectors, s],
                  })
                }
              >
                {s}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-sm font-medium text-ink">Skills</div>
          <div className="flex flex-wrap gap-2">
            {SKILLS.map((s) => (
              <Chip
                key={s}
                active={draft.skills.includes(s)}
                onClick={() =>
                  setDraft({
                    ...draft,
                    skills: draft.skills.includes(s)
                      ? draft.skills.filter((x) => x !== s)
                      : [...draft.skills, s],
                  })
                }
              >
                {s}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-sm font-medium text-ink">Talen</div>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((s) => (
              <Chip
                key={s}
                active={draft.languages.includes(s)}
                onClick={() =>
                  setDraft({
                    ...draft,
                    languages: draft.languages.includes(s)
                      ? draft.languages.filter((x) => x !== s)
                      : [...draft.languages, s],
                  })
                }
              >
                {s}
              </Chip>
            ))}
          </div>
        </div>
        <PrimaryButton onClick={save}>Profiel opslaan</PrimaryButton>
      </div>
    </div>
  )
}

function ToggleRow({
  label,
  on,
  onChange,
}: {
  label: string
  on: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-line bg-paper px-4 py-3">
      <span className="text-sm font-medium">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!on)}
        className={`h-7 w-11 rounded-full p-0.5 transition-colors duration-150 ${on ? 'bg-terra' : 'bg-line'}`}
      >
        <span className={`block h-6 w-6 rounded-full bg-white shadow-sm transition ${on ? 'translate-x-4' : ''}`} />
      </button>
    </label>
  )
}

function Onboarding({ seeker }: { seeker: Seeker }) {
  const store = useStore()
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState(seeker)
  const finish = () => {
    store.updateSeeker(seeker.id, { ...draft, onboardingDone: true })
  }

  const steps = [
    {
      t: 'Wie ben je?',
      d: 'Geen CV-verhaal. Alleen wat werkgevers écht nodig hebben.',
      body: (
        <div className="space-y-4">
          <Field label="Voor- en achternaam">
            <input
              className={inputClass}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Emma Peeters"
            />
          </Field>
          <Field label="Stad">
            <select
              className={inputClass}
              value={draft.city}
              onChange={(e) => setDraft({ ...draft, city: e.target.value })}
            >
              {CITIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Korte voorstelling">
            <textarea
              className={`${inputClass} min-h-[88px]`}
              placeholder="Ik werk in shiften en zoek extra horeca-werk op mijn vrije avonden…"
              value={draft.bio}
              onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
            />
          </Field>
        </div>
      ),
    },
    {
      t: 'Wat kun je?',
      d: 'Kies sectoren en skills. Hoe specifieker, hoe beter de match.',
      body: (
        <div className="space-y-5">
          <div>
            <div className="mb-2 text-sm font-medium text-ink">Sectoren</div>
            <div className="flex flex-wrap gap-2">
              {SECTORS.map((s) => (
                <Chip
                  key={s}
                  active={draft.sectors.includes(s)}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      sectors: draft.sectors.includes(s)
                        ? draft.sectors.filter((x) => x !== s)
                        : [...draft.sectors, s],
                    })
                  }
                >
                  {s}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-sm font-medium text-ink">Skills</div>
            <div className="flex flex-wrap gap-2">
              {SKILLS.map((s) => (
                <Chip
                  key={s}
                  active={draft.skills.includes(s)}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      skills: draft.skills.includes(s)
                        ? draft.skills.filter((x) => x !== s)
                        : [...draft.skills, s],
                    })
                  }
                >
                  {s}
                </Chip>
              ))}
            </div>
          </div>
          <ToggleRow
            label="Rijbewijs B"
            on={draft.hasLicense}
            onChange={(v) => setDraft({ ...draft, hasLicense: v })}
          />
          <ToggleRow
            label="Eigen vervoer"
            on={draft.hasTransport}
            onChange={(v) => setDraft({ ...draft, hasTransport: v })}
          />
        </div>
      ),
    },
    {
      t: 'Wanneer kun je?',
      d: 'Teken je typische week. Je kunt later per dag afwijken.',
      body: (
        <WeekEditor
          recurring={draft.recurring}
          onChange={(day, slots) =>
            setDraft({ ...draft, recurring: { ...draft.recurring, [day]: slots } })
          }
        />
      ),
    },
  ]

  const canNext =
    step === 0
      ? draft.name.trim().length > 2
      : step === 1
        ? draft.skills.length > 0
        : true

  const onboardTips = [
    {
      pose: 'wave' as const,
      title: 'Laten we starten',
      text: 'Eerst je naam en stad. Kort en klaar — geen CV-roman.',
    },
    {
      pose: 'hint' as const,
      title: 'Wat kun je?',
      text: 'Kies sectoren en skills. Hoe specifieker, hoe beter ik je kan matchen.',
    },
    {
      pose: 'point' as const,
      title: 'Je typische week',
      text: 'Teken wanneer je meestal vrij bent. Exacte uren per dag zet je daarna in de kalender.',
    },
  ]

  return (
    <div className="min-h-dvh px-6 py-10">
      <Guide {...onboardTips[step]} />
      <div className="mx-auto max-w-2xl">
        <Logo compact />
        <div className="mt-8 flex gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-terra' : 'bg-line'}`}
            />
          ))}
        </div>
        <div className="mt-8 flex items-end gap-4">
          <Mascot pose={onboardTips[step].pose} size={88} bob />
          <div>
            <p className="text-sm font-medium text-muted">
              Stap {step + 1} van {steps.length}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">{steps[step].t}</h1>
          </div>
        </div>
        <p className="mt-2 text-muted">{steps[step].d}</p>
        <div className={`${cardClass} mt-8 p-6`}>{steps[step].body}</div>
        <div className="mt-8 flex gap-3">
          {step > 0 && <GhostButton onClick={() => setStep(step - 1)}>Terug</GhostButton>}
          {step < steps.length - 1 ? (
            <PrimaryButton onClick={() => canNext && setStep(step + 1)}>Verder</PrimaryButton>
          ) : (
            <PrimaryButton onClick={finish}>Profiel activeren</PrimaryButton>
          )}
        </div>
      </div>
    </div>
  )
}
