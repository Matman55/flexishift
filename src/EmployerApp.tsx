import { useMemo, useState, type ReactNode } from 'react'
import {
  Avatar,
  Chip,
  Field,
  GhostButton,
  Icon,
  MatchRing,
  PingBanner,
  PrimaryButton,
  HourPills,
  WorkplaceCard,
  cardClass,
  inputClass,
} from './components'
import { TimeRangePicker } from './AvailabilityCalendar'
import {
  CITIES,
  CITY_POSTAL,
  CONTRACT_META,
  SECTORS,
  SKILLS,
  defaultContract,
  ensureWorkplace,
  formatDateLong,
  isoDate,
  shiftCountdown,
  workplaceFromCity,
} from './constants'
import { Logo } from './Landing'
import { EmptyMascot, Guide } from './Mascot'
import { rankSeekers, bookedBySeekerOnDate } from './match'
import { slotsFromRange } from './time'
import { useStore } from './store'
import type { MatchResult } from './match'
import type { ContractKind, Employer, Slot } from './types'

type Tab = 'home' | 'search' | 'post' | 'jobs' | 'inbox'

export function EmployerApp() {
  const store = useStore()
  const employer = store.employers.find((e) => e.id === store.session?.employerId)
  const [tab, setTab] = useState<Tab>('home')
  const [toast, setToast] = useState<string | null>(null)
  const [prefill, setPrefill] = useState<{
    date: string
    slots: Slot[]
    startTime: string
    endTime: string
    skills: string[]
    city: string
    urgent: boolean
  } | null>(null)

  if (!employer) return null

  const pingToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2600)
  }

  if (!employer.onboardingDone) {
    return <EmployerOnboarding employer={employer} />
  }

  const myJobs = store.jobs.filter((j) => j.employerId === employer.id)
  const inbox = store.requests.filter((r) => r.employerId === employer.id)
  const pending = inbox.filter((r) => r.status === 'pending' && r.from === 'seeker').length
  const ping = inbox.find((r) => !r.readAt && r.from === 'seeker' && r.status === 'pending')

  return (
    <Shell
      company={employer.company}
      tab={tab}
      setTab={(t) => {
        if (t === 'inbox') store.markRequestsRead('employer', employer.id)
        setTab(t)
      }}
      pending={pending}
      onLogout={store.logout}
      toast={toast}
      banner={
        ping && tab !== 'inbox' ? (
          <PingBanner
            title="Nieuwe sollicitatie"
            text={`${store.seekers.find((s) => s.id === ping.seekerId)?.name ?? 'Iemand'} voor ${ping.title}`}
            onClick={() => {
              store.markRequestsRead('employer', employer.id)
              setTab('inbox')
            }}
          />
        ) : null
      }
    >
      {tab === 'home' && (
        <Home
          company={employer.company}
          city={employer.city}
          jobs={myJobs.length}
          pending={pending}
          onSpoed={() => {
            setPrefill({
              date: isoDate(0),
              slots: ['avond'],
              startTime: '18:00',
              endTime: '23:00',
              skills: ['Bediening', 'Bar / tappen'],
              city: employer.city,
              urgent: true,
            })
            setTab('search')
          }}
          onSearch={() => setTab('search')}
          onPost={() => setTab('post')}
        />
      )}
      {tab === 'search' && (
        <SearchPane
          employer={employer}
          defaultCity={employer.city}
          prefill={prefill}
          onAsk={(m, title, date, slots, startTime, endTime) => {
            store.addRequest({
              jobId: null,
              employerId: employer.id,
              seekerId: m.seeker.id,
              from: 'employer',
              message: `Hallo ${m.seeker.name.split(' ')[0]}, ${employer.company} heeft je nodig op ${formatDateLong(date)} van ${startTime} tot ${endTime}. Past dat?`,
              date,
              slots,
              startTime,
              endTime,
              title,
              city: employer.city,
            })
            pingToast(`Aanvraag gestuurd naar ${m.seeker.name}`)
          }}
        />
      )}
      {tab === 'post' && (
        <PostPane
          employerId={employer.id}
          company={employer.company}
          city={employer.city}
          sector={employer.sector}
          onPosted={() => {
            pingToast('Opdracht geplaatst — matching kandidaten staan klaar')
            setTab('jobs')
          }}
        />
      )}
      {tab === 'jobs' && (
        <JobsPane
          employer={employer}
          onAskFromJob={(job, m) => {
            store.addRequest({
              jobId: job.id,
              employerId: employer.id,
              seekerId: m.seeker.id,
              from: 'employer',
              message: `We zochten iemand voor “${job.title}”. Jij scoort hoog. Kun je ${formatDateLong(job.date)}?`,
              date: job.date,
              slots: job.slots,
              startTime: job.startTime,
              endTime: job.endTime,
              title: job.title,
              city: job.city,
            })
            pingToast(`Aanvraag gestuurd naar ${m.seeker.name}`)
          }}
        />
      )}
      {tab === 'inbox' && (
        <InboxPane
          employerId={employer.id}
          onStatus={(id, status) => {
            store.setRequestStatus(id, status)
            pingToast(status === 'accepted' ? 'Bevestigd' : 'Afgewezen')
          }}
        />
      )}
    </Shell>
  )
}

function Shell({
  company,
  tab,
  setTab,
  pending,
  onLogout,
  toast,
  banner,
  children,
}: {
  company: string
  tab: Tab
  setTab: (t: Tab) => void
  pending: number
  onLogout: () => void
  toast: string | null
  banner?: ReactNode
  children: ReactNode
}) {
  const items: { id: Tab; label: string; icon: 'home' | 'search' | 'plus' | 'brief' | 'inbox' }[] = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'search', label: 'Zoek', icon: 'search' },
    { id: 'post', label: 'Plaats', icon: 'plus' },
    { id: 'jobs', label: 'Jobs', icon: 'brief' },
    { id: 'inbox', label: 'Inbox', icon: 'inbox' },
  ]
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[232px_1fr]">
      <aside className="hidden border-r border-line bg-cream md:flex md:flex-col md:px-4 md:py-6">
        <Logo compact />
        <p className="mt-3 px-3 text-xs font-medium text-muted">{company}</p>
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
        <main className="mx-auto max-w-3xl px-6 py-8 md:max-w-5xl md:px-10 md:py-10">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-cream/95 px-1 py-2 backdrop-blur md:hidden">
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            onClick={() => setTab(it.id)}
            className={`flex flex-col items-center gap-0.5 text-[11px] font-semibold ${
              tab === it.id ? 'text-terra' : 'text-muted'
            }`}
          >
            <Icon name={it.icon} />
            {it.label}
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
  company,
  city,
  jobs,
  pending,
  onSpoed,
  onSearch,
  onPost,
}: {
  company: string
  city: string
  jobs: number
  pending: number
  onSpoed: () => void
  onSearch: () => void
  onPost: () => void
}) {
  return (
    <div>
      <Guide
        pose="search"
        title="Personeel vinden"
        text="Iemand ziek of extra drukte? Tik op spoed. Ik zoek wie écht vrij is op dat uur."
      />
      <p className="text-sm font-medium text-muted">{company} · {city}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">
        Vind iemand die écht vrij is.
      </h1>
      <p className="mt-3 max-w-lg leading-relaxed text-muted">
        Geen CV-berg. Filter op dag, shift en skills — FlexiShift toont wie kan, niet wie
        “misschien ooit”.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={onSpoed}
          className="rounded-2xl bg-ink p-6 text-left text-white shadow-[0_12px_30px_rgba(17,17,17,0.18)] transition-transform duration-150 hover:-translate-y-0.5"
        >
          <span className="grid h-10 w-10 place-items-center rounded-full bg-terra text-ink">
            <Icon name="bolt" />
          </span>
          <div className="mt-4 text-xl font-extrabold tracking-tight">Spoed: vanavond</div>
          <p className="mt-1.5 text-sm text-white/70">Collega ziek of extra drukte? Zie meteen wie last-minute klaarstaat.</p>
        </button>
        <button
          type="button"
          onClick={onSearch}
          className={`${cardClass} p-6 text-left transition-transform duration-150 hover:-translate-y-0.5`}
        >
          <Icon name="search" />
          <div className="mt-4 text-xl font-semibold tracking-tight">Zoek op uren</div>
          <p className="mt-1.5 text-sm text-muted">Kies datum en exact van–tot. Alleen wie écht overlap heeft, verschijnt.</p>
        </button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className={`${cardClass} p-5`}>
          <div className="text-2xl font-semibold tracking-tight">{jobs}</div>
          <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">opdrachten</div>
        </div>
        <div className={`${cardClass} p-5`}>
          <div className="text-2xl font-semibold tracking-tight">{pending}</div>
          <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">open berichten</div>
        </div>
      </div>
      <GhostButton onClick={onPost} className="mt-6">
        Nieuwe opdracht plaatsen
      </GhostButton>
    </div>
  )
}

function SearchPane({
  employer,
  defaultCity,
  prefill,
  onAsk,
}: {
  employer: Employer
  defaultCity: string
  prefill: {
    date: string
    slots: Slot[]
    startTime: string
    endTime: string
    skills: string[]
    city: string
    urgent: boolean
  } | null
  onAsk: (
    m: MatchResult,
    title: string,
    date: string,
    slots: Slot[],
    startTime: string,
    endTime: string,
  ) => void
}) {
  const store = useStore()
  const [date, setDate] = useState(prefill?.date ?? isoDate(0))
  const [startTime, setStartTime] = useState(prefill?.startTime ?? '18:00')
  const [endTime, setEndTime] = useState(prefill?.endTime ?? '23:00')
  const [city, setCity] = useState(prefill?.city ?? defaultCity)
  const [skills, setSkills] = useState<string[]>(prefill?.skills ?? ['Bediening'])
  const [urgent, setUrgent] = useState(prefill?.urgent ?? false)
  const [onlyLastMinute, setOnlyLastMinute] = useState(prefill?.urgent ?? false)
  const slots = slotsFromRange(startTime, endTime)

  const results = useMemo(() => {
    const ranked = rankSeekers(
      store.seekers.filter((s) => s.onboardingDone),
      {
        date,
        slots,
        startTime,
        endTime,
        skills,
        city,
        urgent,
        workplace: employer.workplace ?? workplaceFromCity(city),
        bookedBySeeker: bookedBySeekerOnDate(store.requests, date),
      },
    )
    return onlyLastMinute ? ranked.filter((r) => r.seeker.lastMinute) : ranked
  }, [
    store.seekers,
    store.requests,
    date,
    slots,
    startTime,
    endTime,
    skills,
    city,
    urgent,
    onlyLastMinute,
    employer.workplace,
  ])

  const favSet = new Set(employer.favorites)
  const favs = results.filter((m) => favSet.has(m.seeker.id))
  const rest = results.filter((m) => !favSet.has(m.seeker.id))
  const title = urgent ? 'Spoedopdracht' : 'Invaller gezocht'

  return (
    <div>
      <Guide
        pose="search"
        title="Wie is vrij?"
        text="Kies datum en exacte uren. Ik toon alleen mensen waarvan de blokken overlappen."
      />
      <h1 className="text-3xl font-semibold tracking-tight">Wie is vrij?</h1>
      <p className="mt-2 text-sm text-muted">
        Kies wanneer je iemand nodig hebt. Alleen mensen met overlapping in uren verschijnen.
      </p>
      <div className={`${cardClass} mt-8 space-y-5 p-6`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Datum">
            <input
              type="date"
              className={inputClass}
              value={date}
              min={isoDate(0)}
              max={isoDate(21)}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Stad">
            <select className={inputClass} value={city} onChange={(e) => setCity(e.target.value)}>
              {CITIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
        </div>
        <div>
          <div className="mb-2 text-sm font-medium text-ink">
            Wanneer — exacte uren
          </div>
          <TimeRangePicker
            start={startTime}
            end={endTime}
            onChange={(s, e) => {
              setStartTime(s)
              setEndTime(e)
            }}
          />
        </div>
        <div>
          <div className="mb-2 text-sm font-medium text-ink">Skills</div>
          <div className="flex flex-wrap gap-2">
            {SKILLS.map((s) => (
              <Chip
                key={s}
                active={skills.includes(s)}
                onClick={() =>
                  setSkills(
                    skills.includes(s) ? skills.filter((x) => x !== s) : [...skills, s],
                  )
                }
              >
                {s}
              </Chip>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip active={urgent} onClick={() => setUrgent(!urgent)}>
            Spoed
          </Chip>
          <Chip active={onlyLastMinute} onClick={() => setOnlyLastMinute(!onlyLastMinute)}>
            Alleen last-minute
          </Chip>
        </div>
      </div>

      <div className="mt-8 flex items-end justify-between">
        <h2 className="text-lg font-semibold tracking-tight">{results.length} kandidaten</h2>
        <p className="text-xs text-muted">{formatDateLong(date)}</p>
      </div>
      {favs.length > 0 && (
        <section className="mt-4">
          <h3 className="text-sm font-semibold">Favorieten die nu vrij zijn</h3>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            {favs.map((m) => (
              <CandidateCard
                key={m.seeker.id}
                match={m}
                favorite
                onToggleFavorite={() => store.toggleFavorite(employer.id, m.seeker.id)}
                onAsk={() => onAsk(m, title, date, slots, startTime, endTime)}
              />
            ))}
          </div>
        </section>
      )}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {results.length === 0 && (
          <div className="lg:col-span-2">
            <EmptyMascot
              pose="search"
              title="Niemand vrij op dit uur"
              text="Probeer een ander tijdstip, flexibel, of een nabije stad. Ik kijk opnieuw."
            />
          </div>
        )}
        {rest.map((m) => (
          <CandidateCard
            key={m.seeker.id}
            match={m}
            favorite={false}
            onToggleFavorite={() => store.toggleFavorite(employer.id, m.seeker.id)}
            onAsk={() => onAsk(m, title, date, slots, startTime, endTime)}
          />
        ))}
      </div>
    </div>
  )
}

function CandidateCard({
  match,
  onAsk,
  favorite,
  onToggleFavorite,
}: {
  match: MatchResult
  onAsk: () => void
  favorite?: boolean
  onToggleFavorite?: () => void
}) {
  const s = match.seeker
  return (
    <article className={`${cardClass} p-5`}>
      <div className="flex gap-3">
        <Avatar name={s.name} hue={s.hue} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-medium">{s.name}</h3>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                <Icon name="pin" className="h-3.5 w-3.5" /> {match.travel} · ★ {s.rating} · {s.jobsDone} jobs
              </p>
            </div>
            <div className="flex items-center gap-2">
              {onToggleFavorite && (
                <button
                  type="button"
                  onClick={onToggleFavorite}
                  className={`grid h-9 w-9 place-items-center rounded-full border ${favorite ? 'border-terra bg-terra/30 text-ink' : 'border-line text-muted'}`}
                  aria-label={favorite ? 'Favoriet verwijderen' : 'Bewaar als favoriet'}
                >
                  <Icon name="star" className="h-4 w-4" />
                </button>
              )}
              <MatchRing score={match.score} />
            </div>
          </div>
        </div>
      </div>
      <p className="mt-4 line-clamp-2 text-sm text-muted">{s.bio}</p>
      <div className="mt-4">
        <div className="text-[11px] font-medium text-muted">Vrij die dag</div>
        <div className="mt-1.5">
          <HourPills hours={match.hours} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {s.skills.slice(0, 5).map((sk) => (
          <span key={sk} className="rounded-md bg-paper px-2 py-0.5 text-[11px] font-medium text-muted">
            {sk}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-medium">
        {s.lastMinute && <span className="badge-accent rounded-md px-2 py-0.5">last-minute</span>}
        {s.hasTransport && <span className="badge-muted rounded-md px-2 py-0.5">eigen vervoer</span>}
        {s.hasLicense && <span className="badge-muted rounded-md px-2 py-0.5">rijbewijs</span>}
        <span className="badge-muted rounded-md px-2 py-0.5">vanaf €{s.hourlyRateMin}/u</span>
        <span className="badge-muted rounded-md px-2 py-0.5">{s.languages.join(', ')}</span>
      </div>
      <p className="mt-3 text-xs text-muted">{match.reasons.join(' · ')}</p>
      <PrimaryButton onClick={onAsk} className="mt-4 w-full">
        {favorite ? `Vraag ${s.name.split(' ')[0]} opnieuw` : 'Vraag aan'}
      </PrimaryButton>
    </article>
  )
}

function PostPane({
  employerId,
  company,
  city,
  sector,
  onPosted,
}: {
  employerId: string
  company: string
  city: string
  sector: string
  onPosted: () => void
}) {
  const store = useStore()
  const [title, setTitle] = useState('Invaller gezocht')
  const [date, setDate] = useState(isoDate(0))
  const [startTime, setStartTime] = useState('18:00')
  const [endTime, setEndTime] = useState('23:00')
  const [skills, setSkills] = useState<string[]>(['Bediening'])
  const [jobCity, setJobCity] = useState(city)
  const [jobSector, setJobSector] = useState(sector)
  const [rate, setRate] = useState(15)
  const [people, setPeople] = useState(1)
  const [urgent, setUrgent] = useState(true)
  const [description, setDescription] = useState(
    'We hebben extra handen nodig. Snel inwerkbaar, vriendelijk, geen gedoe.',
  )
  const [address, setAddress] = useState('')
  const [access, setAccess] = useState('')
  const [parking, setParking] = useState('')
  const [notes, setNotes] = useState('')
  const [contractKind, setContractKind] = useState<ContractKind>(defaultContract(sector))

  const slots = slotsFromRange(startTime, endTime)

  const preview = rankSeekers(
    store.seekers.filter((s) => s.onboardingDone),
    { date, slots, startTime, endTime, skills, city: jobCity, urgent, bookedBySeeker: bookedBySeekerOnDate(store.requests, date) },
  ).slice(0, 4)

  return (
    <div>
      <Guide
        pose="point"
        title="Plaats een opdracht"
        text="Zet datum en van–tot. Rechts zie je live wie al matcht — handig om meteen iemand te vragen."
      />
      <h1 className="text-3xl font-semibold tracking-tight">Plaats een opdracht</h1>
      <p className="mt-2 text-sm text-muted">
        Terwijl je typt, zie je rechts (of eronder) wie al matcht.
      </p>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <form
          className={`${cardClass} space-y-5 p-6`}
          onSubmit={(e) => {
            e.preventDefault()
            store.addJob({
              employerId,
              title,
              company,
              city: jobCity,
              date,
              slots,
              startTime,
              endTime,
              skills,
              sector: jobSector,
              hourlyRate: rate,
              peopleNeeded: people,
              urgent,
              description,
              contractKind,
              requiresLicense: skills.includes('Chauffeur'),
              workplace: workplaceFromCity(jobCity, {
                address: address.trim() || `Centrum ${jobCity}`,
                postal: CITY_POSTAL[jobCity] ?? '9000',
                access: access.trim() || undefined,
                parking: parking.trim() || undefined,
                contactOnSite: company,
                notes: notes.trim() || undefined,
              }),
            })
            onPosted()
          }}
        >
          <Field label="Titel">
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Datum">
              <input
                type="date"
                className={inputClass}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label="Stad">
              <select className={inputClass} value={jobCity} onChange={(e) => setJobCity(e.target.value)}>
                {CITIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Adres werkplek">
            <input
              className={inputClass}
              placeholder="Straat en nummer"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </Field>
          <Field label="Hoe geraak je er (optioneel)">
            <input
              className={inputClass}
              placeholder="Tram, station, fiets…"
              value={access}
              onChange={(e) => setAccess(e.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Parking (optioneel)">
              <input
                className={inputClass}
                placeholder="Bv. gratis op het terrein"
                value={parking}
                onChange={(e) => setParking(e.target.value)}
              />
            </Field>
            <Field label="Extra voor wie komt">
              <input
                className={inputClass}
                placeholder="Ingang, kleding, badge…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
          </div>
          <TimeRangePicker
            start={startTime}
            end={endTime}
            onChange={(s, e) => {
              setStartTime(s)
              setEndTime(e)
            }}
          />
          <Field label="Sector">
            <select
              className={inputClass}
              value={jobSector}
              onChange={(e) => {
                setJobSector(e.target.value)
                setContractKind(defaultContract(e.target.value))
              }}
            >
              {SECTORS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Statuut">
            <select
              className={inputClass}
              value={contractKind}
              onChange={(e) => setContractKind(e.target.value as ContractKind)}
            >
              {(Object.keys(CONTRACT_META) as ContractKind[]).map((k) => (
                <option key={k} value={k}>
                  {CONTRACT_META[k].label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-muted">{CONTRACT_META[contractKind].hint}</p>
          </Field>
          <div>
            <div className="mb-2 text-sm font-medium text-ink">Skills</div>
            <div className="flex flex-wrap gap-2">
              {SKILLS.map((s) => (
                <Chip
                  key={s}
                  active={skills.includes(s)}
                  onClick={() =>
                    setSkills(skills.includes(s) ? skills.filter((x) => x !== s) : [...skills, s])
                  }
                >
                  {s}
                </Chip>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Uurloon (€)">
              <input
                type="number"
                className={inputClass}
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
              />
            </Field>
            <Field label="Aantal mensen">
              <input
                type="number"
                className={inputClass}
                value={people}
                onChange={(e) => setPeople(Number(e.target.value))}
              />
            </Field>
          </div>
          <Chip active={urgent} onClick={() => setUrgent(!urgent)}>
            Markeer als spoed
          </Chip>
          <Field label="Omschrijving">
            <textarea
              className={`${inputClass} min-h-[100px]`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <PrimaryButton type="submit">Opdracht plaatsen</PrimaryButton>
        </form>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Live matches</h2>
          <p className="mt-1 text-xs text-muted">{preview.length} mensen vrij op dit moment</p>
          <div className="mt-4 space-y-3">
            {preview.map((m) => (
              <div key={m.seeker.id} className={`${cardClass} flex items-center gap-3 p-3`}>
                <Avatar name={m.seeker.name} hue={m.seeker.hue} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{m.seeker.name}</div>
                  <HourPills hours={m.hours} />
                </div>
                <MatchRing score={m.score} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function JobsPane({
  employer,
  onAskFromJob,
}: {
  employer: Employer
  onAskFromJob: (job: import('./types').Job, m: MatchResult) => void
}) {
  const store = useStore()
  const jobs = store.jobs.filter((j) => j.employerId === employer.id)
  const [openId, setOpenId] = useState<string | null>(jobs[0]?.id ?? null)
  const selected = jobs.find((j) => j.id === openId)
  const filledOf = (jobId: string) =>
    store.requests.filter((r) => r.jobId === jobId && r.status === 'accepted').length
  const matches = selected
    ? rankSeekers(store.seekers.filter((s) => s.onboardingDone), {
        date: selected.date,
        slots: selected.slots,
        startTime: selected.startTime,
        endTime: selected.endTime,
        skills: selected.skills,
        city: selected.city,
        urgent: selected.urgent,
        workplace: selected.workplace,
        hourlyRate: selected.hourlyRate,
        requiresLicense: selected.requiresLicense,
        bookedBySeeker: bookedBySeekerOnDate(store.requests, selected.date),
      })
    : []

  return (
    <div>
      <Guide
        pose="idle"
        title="Jouw opdrachten"
        text="Open een opdracht. Ik toon rechts wie vrij is op die dag en dat uur."
      />
      <h1 className="text-3xl font-semibold tracking-tight">Jouw opdrachten</h1>
      <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-2">
          {jobs.length === 0 && (
            <EmptyMascot
              pose="hint"
              title="Nog geen opdrachten"
              text="Plaats er één via het plus-tabblad. Ik zoek meteen matching mensen."
            />
          )}
          {jobs.map((j) => (
            <button
              key={j.id}
              type="button"
              onClick={() => setOpenId(j.id)}
              className={`w-full rounded-xl border p-4 text-left shadow-sm transition-colors duration-150 ${
                openId === j.id ? 'border-terra/40 bg-cream' : 'border-line bg-cream hover:bg-paper'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{j.title}</span>
                {j.urgent && <span className="badge-spoed rounded-md px-2 py-0.5 text-[11px] font-medium">spoed</span>}
              </div>
              <p className="mt-1 text-xs text-muted">
                {formatDateLong(j.date)} · {j.city} · {filledOf(j.id)}/{j.peopleNeeded} ·{' '}
                {j.status === 'open' ? 'open' : 'ingevuld'}
              </p>
            </button>
          ))}
        </div>
        <div>
          {selected && (
            <>
              <h2 className="text-lg font-semibold tracking-tight">Wie past bij deze job?</h2>
              <div className="mt-1 text-sm text-muted">
                {selected.startTime}–{selected.endTime} · {matches.length} matches
              </div>
              <div className="mt-4">
                <WorkplaceCard workplace={ensureWorkplace(selected)} />
              </div>
              <div className="mt-4 space-y-4">
                {matches.slice(0, 8).map((m) => (
                  <CandidateCard
                    key={m.seeker.id}
                    match={m}
                    favorite={employer.favorites.includes(m.seeker.id)}
                    onToggleFavorite={() => store.toggleFavorite(employer.id, m.seeker.id)}
                    onAsk={() => onAskFromJob(selected, m)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function InboxPane({
  employerId,
  onStatus,
}: {
  employerId: string
  onStatus: (id: string, status: 'accepted' | 'declined') => void
}) {
  const store = useStore()
  const items = store.requests.filter((r) => r.employerId === employerId)
  return (
    <div>
      <Guide
        pose="hint"
        title="Inbox"
        text="Sollicitaties en jouw aanvragen komen hier. Aanvaarden of afwijzen doe je met één tik."
      />
      <h1 className="text-3xl font-semibold tracking-tight">Inbox</h1>
      <div className="mt-6 space-y-3">
        {items.length === 0 && (
          <EmptyMascot
            pose="idle"
            title="Nog geen berichten"
            text="Vraag iemand aan vanuit zoeken, of wacht tot een flexi solliciteert."
          />
        )}
        {items.map((r) => {
          const seeker = store.seekers.find((s) => s.id === r.seekerId)
          return (
            <article key={r.id} className={`${cardClass} p-5`}>
              <div className="flex items-start gap-3">
                {seeker && <Avatar name={seeker.name} hue={seeker.hue} />}
                <div className="flex-1">
                  <div className="text-xs font-medium text-muted">
                    {r.from === 'seeker' ? 'Sollicitatie' : 'Jouw aanvraag'}
                  </div>
                  <h3 className="mt-1 font-medium">{r.title}</h3>
                  <p className="text-sm text-muted">
                    {seeker?.name} · {formatDateLong(r.date)}
                  </p>
                </div>
                <span
                  className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                    r.status === 'pending'
                      ? 'badge-pending'
                      : r.status === 'accepted'
                        ? 'badge-ok'
                        : 'badge-muted'
                  }`}
                >
                  {r.status === 'pending' ? 'Open' : r.status === 'accepted' ? 'Bevestigd' : 'Afgewezen'}
                </span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted">{r.message}</p>
              {r.extras && (
                <p className="mt-2 text-xs text-muted">
                  Aankomst {r.extras.arriveBy} · {r.extras.transport}
                  {r.extras.question ? ` · ${r.extras.question}` : ''}
                </p>
              )}
              <p className="mt-2 text-xs text-muted">{shiftCountdown(r.date, r.startTime, r.endTime).label}</p>
              {r.status === 'pending' && r.from === 'seeker' && (
                <div className="mt-4 flex gap-2">
                  <PrimaryButton onClick={() => onStatus(r.id, 'accepted')} className="!py-2.5">
                    Aanvaarden
                  </PrimaryButton>
                  <GhostButton onClick={() => onStatus(r.id, 'declined')} className="!py-2.5">
                    Afwijzen
                  </GhostButton>
                </div>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}

function EmployerOnboarding({ employer }: { employer: Employer }) {
  const store = useStore()
  const [draft, setDraft] = useState(employer)
  const [address, setAddress] = useState(employer.workplace?.address ?? '')
  const can = draft.company.trim().length > 1 && draft.contact.trim().length > 1

  return (
    <div className="min-h-dvh bg-paper">
      <header className="mx-auto flex max-w-lg items-center justify-between px-6 py-5">
        <Logo compact />
        <button type="button" onClick={store.logout} className="text-sm font-medium text-muted">
          Terug
        </button>
      </header>
      <main className="mx-auto max-w-lg px-6 pb-16">
        <Guide
          pose="wave"
          title="Jouw zaak"
          text="Naam, stad en adres. Daarna kun je meteen iemand zoeken."
        />
        <h1 className="text-3xl font-semibold tracking-tight">Nieuwe zaak</h1>
        <p className="mt-2 text-sm text-muted">Kort en klaar — geen administratie hier.</p>
        <div className={`${cardClass} mt-8 space-y-4 p-6`}>
          <Field label="Naam van de zaak">
            <input
              className={inputClass}
              value={draft.company}
              placeholder="Café De Kroon"
              onChange={(e) => setDraft({ ...draft, company: e.target.value })}
            />
          </Field>
          <Field label="Contactpersoon">
            <input
              className={inputClass}
              value={draft.contact}
              placeholder="Annelies De Witte"
              onChange={(e) => setDraft({ ...draft, contact: e.target.value })}
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
          <Field label="Sector">
            <select
              className={inputClass}
              value={draft.sector}
              onChange={(e) => setDraft({ ...draft, sector: e.target.value })}
            >
              {SECTORS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Adres werkplek">
            <input
              className={inputClass}
              value={address}
              placeholder="Straat en nummer"
              onChange={(e) => setAddress(e.target.value)}
            />
          </Field>
          <PrimaryButton
            className="w-full"
            onClick={() => {
              if (!can) return
              store.updateEmployer(employer.id, {
                ...draft,
                onboardingDone: true,
                workplace: workplaceFromCity(draft.city, {
                  address: address.trim() || `Centrum ${draft.city}`,
                }),
              })
            }}
          >
            Zaak klaarzetten
          </PrimaryButton>
        </div>
      </main>
    </div>
  )
}
