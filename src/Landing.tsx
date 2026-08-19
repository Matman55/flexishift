import { useState } from 'react'
import { SEEKERS } from './data'
import {
  Avatar,
  DarkButton,
  Icon,
  OpenSeekerProfile,
  PrimaryButton,
  RecurringWeekPreview,
  SlotPills,
} from './components'
import { Logo } from './Mascot'
import { AuthModal } from './Auth'
import { useStore } from './store'
import type { Role, Slot } from './types'

const emma = SEEKERS[0]

const sectors = [
  { t: 'Horeca', d: 'Bar, keuken, bediening' },
  { t: 'Events', d: 'Opbouw, crew, onthaal' },
  { t: 'Retail', d: 'Kassa & winkelvloer' },
  { t: 'Logistiek', d: 'Magazijn & ritten' },
]

export function Landing({
  onDemoSeeker,
  onDemoEmployer,
  onReset,
}: {
  onDemoSeeker: () => void
  onDemoEmployer: () => void
  onReset: () => void
}) {
  const store = useStore()
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot'>('login')
  const [authRole, setAuthRole] = useState<Role>('seeker')
  const openAuth = (mode: 'login' | 'signup', role: Role = 'seeker') => {
    setAuthMode(mode)
    setAuthRole(role)
    store.clearAuthNotice()
    setAuthOpen(true)
  }

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="blob pointer-events-none absolute -left-24 top-40 h-64 w-64 bg-zinc-100" />
      <div className="blob-alt pointer-events-none absolute -right-16 top-[520px] h-72 w-72 bg-zinc-100" />

      <header className="relative z-10 mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
        <Logo />
        <nav className="hidden items-center gap-8 text-sm font-medium text-muted md:flex">
          <span className="text-ink after:mt-1 after:block after:h-0.5 after:w-6 after:rounded-full after:bg-terra">
            Home
          </span>
          <a href="#hoe" className="hover:text-ink">Hoe het werkt</a>
          <a href="#wie" className="hover:text-ink">Wie mag een flexi-job?</a>
          <a href="#mensen" className="hover:text-ink">Mensen</a>
        </nav>
        <div className="flex w-full max-w-sm flex-col items-stretch gap-3 md:w-auto md:max-w-none md:flex-row md:items-center md:gap-2">
          <DarkButton onClick={() => openAuth('login')} className="w-full py-3.5 text-base md:w-auto md:!px-3.5 md:!py-2 md:text-sm">
            Inloggen
          </DarkButton>
          <PrimaryButton onClick={() => openAuth('signup')} className="w-full py-3.5 text-base md:w-auto md:!px-3.5 md:!py-2 md:text-sm">
            Account aanmaken
          </PrimaryButton>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-6 pb-16 pt-8 md:grid-cols-2 md:pt-12">
        <div>
          <p className="font-script text-4xl text-terra md:text-5xl">Hallo daar!</p>
          <h1 className="mt-2 max-w-xl text-4xl font-extrabold leading-[1.12] tracking-tight text-ink sm:text-5xl">
            Flexijobs die passen bij <span className="text-terra">jouw</span> shiften.
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-muted">
            Werk je in ploegen? Zet exact wanneer je vrij bent — van 14:30 tot 22:00 mag.
            Werkgevers vinden wie écht in de buurt is én op dat uur kan.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <DarkButton onClick={() => openAuth('signup', 'seeker')}>
              Start als werkzoekende <Icon name="arrow" className="h-4 w-4" />
            </DarkButton>
            <PrimaryButton onClick={() => openAuth('signup', 'employer')}>Ik zoek personeel</PrimaryButton>
          </div>
          <p className="mt-4 text-xs text-muted">
            Liever eerst kijken?{' '}
            <button type="button" className="underline hover:text-ink" onClick={onDemoSeeker}>
              Demo als Emma
            </button>
            {' · '}
            <button type="button" className="underline hover:text-ink" onClick={onDemoEmployer}>
              Demo als Café De Kroon
            </button>
          </p>
        </div>

        <div className="relative mx-auto h-[420px] w-full max-w-[440px]">
          <div className="blob absolute left-[8%] top-[6%] h-[78%] w-[78%] bg-terra" />
          <div className="blob-alt absolute -right-2 bottom-10 h-28 w-28 bg-zinc-200" />
          <div className="blob blob-dots absolute -left-4 top-16 h-24 w-24 bg-ink" />
          <div className="absolute inset-0 flex items-end justify-center pb-2">
            <img
              src={`${import.meta.env.BASE_URL}flexi.png?v=2`}
              alt="Flexi, de mascotte van FlexiShift"
              className="mascot-bob h-[340px] w-auto max-w-full bg-transparent object-contain sm:h-[380px]"
              style={{ backgroundColor: 'transparent' }}
            />
          </div>
        </div>
      </section>

      <section id="wie" className="relative z-10 mx-auto max-w-6xl px-6 py-8 md:py-16">
        <p className="font-script text-3xl text-terra">Eerst dit</p>
        <h2 className="text-3xl font-extrabold tracking-tight">Wie mag een flexi-job doen?</h2>
        <p className="mt-4 max-w-2xl leading-relaxed text-muted">
          Een flexi-job is een Belgisch statuut: extra werk naast een hoofdjob, of als gepensioneerde.
          Niet iedereen mag dat. De RSZ controleert dit via Dimona — FlexiShift matcht alleen mensen en shiften.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-line bg-white p-6 shadow-[0_10px_30px_rgba(17,17,17,0.06)]">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Jij mag, als</div>
            <h3 className="mt-1 text-xl font-bold tracking-tight">Dit klopt voor jou</h3>
            <ul className="mt-5 space-y-3 text-sm leading-relaxed">
              {[
                'Je werkt al minstens 4/5 (80%) als werknemer, bij één of meer andere werkgevers.',
                'Dat 4/5-werk telde in het derde kwartaal vóór de flexi-job (voorbeeld: flexi in april–juni → je werkte 4/5 in juli–september het jaar voordien).',
                'Je bent gepensioneerd en staat in het pensioenkadaster in het kwartaal van de flexi-job. Dan vervalt de 4/5-regel.',
                'Je bent 18 of ouder.',
              ].map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-terra">
                    <Icon name="check" className="h-3.5 w-3.5" />
                  </span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-line bg-white p-6 shadow-[0_10px_30px_rgba(17,17,17,0.06)]">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Meestal niet</div>
            <h3 className="mt-1 text-xl font-bold tracking-tight">Dit volstaat niet</h3>
            <ul className="mt-5 space-y-3 text-sm leading-relaxed">
              {[
                'Student: daarvoor bestaat studentenarbeid, geen flexi-job.',
                'Zelfstandige: je kunt (nog) geen flexi-job doen.',
                'Werkloos of zonder die 4/5-hoofdjob: dan val je buiten het statuut.',
                'Dezelfde werkgever waar je in dat kwartaal al een gewoon contract hebt.',
                'Net van voltijds naar 4/5 gegaan: er geldt een wachtperiode (derde en vierde kwartaal na de vermindering).',
              ].map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-white">
                    <Icon name="x" className="h-3.5 w-3.5" />
                  </span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-6 max-w-3xl text-sm leading-relaxed text-muted">
          Extra’s: tot €18.440 flexi-inkomen in 2026 is voor wie 4/5 werkt meestal belastingvrij; daarboven gelden
          normale regels. Gepensioneerden verdienen meestal onbeperkt belastingvrij bij — bij vervroegd pensioen
          kunnen inkomensgrenzen je pensioen beïnvloeden. De zaak doet Dimona; FlexiShift is geen juridisch advies.
        </p>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <p className="font-script text-3xl text-terra">Wat zoek je?</p>
        <h2 className="text-3xl font-extrabold tracking-tight">Sectoren waar flexi’s het verschil maken</h2>
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {sectors.map((s) => (
            <div
              key={s.t}
              className="rounded-2xl bg-zinc-50 px-5 py-8 text-center shadow-[0_8px_24px_rgba(17,17,17,0.04)]"
            >
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-ink text-terra">
                <Icon name="brief" />
              </div>
              <div className="mt-4 font-bold">{s.t}</div>
              <div className="mt-1 text-sm text-muted">{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="hoe" className="relative z-10 mx-auto max-w-6xl px-6 py-8 md:py-16">
        <div className="grid gap-12 md:grid-cols-2">
          <div>
            <p className="font-script text-3xl text-terra">Voor shiftwerkers</p>
            <h2 className="text-3xl font-extrabold tracking-tight">Jouw vrije uren, geen ellenlange CV</h2>
            <p className="mt-4 leading-relaxed text-muted">
              Klik op een dag en zet exact van–tot. Een vaste week als sjabloon, daarna finetunen
              per dag. Werkgevers zien alleen uren die écht overlapen.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                'Exacte uren + last-minute knop',
                'Kort profiel in een paar vragen',
                'Matches op skills, afstand én overlapping uren',
              ].map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-terra">
                    <Icon name="check" className="h-3.5 w-3.5" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-script text-3xl text-terra">Voor werkgevers</p>
            <h2 className="text-3xl font-extrabold tracking-tight">Vanavond nog iemand nodig?</h2>
            <p className="mt-4 leading-relaxed text-muted">
              Ziek gevallen collega, extra terras of een eenmalig event: filter op stad, skillset
              en tijdstip. Alleen mensen die écht vrij zijn, komen in beeld.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                'Spoedopdracht in een paar tikken',
                'Kandidaten gerangschikt op match',
                'Direct aanvragen, ja of nee in de inbox',
              ].map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-ink text-white">
                    <Icon name="check" className="h-3.5 w-3.5" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="font-script text-3xl text-terra">Zo simpel</p>
            <h2 className="text-3xl font-extrabold tracking-tight">Drie stappen, klaar</h2>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { n: '01', t: 'Kort profiel', d: 'Sector, skills, talen, rijbewijs. Vijf vragen en je bent zichtbaar.' },
            { n: '02', t: 'Vrije uren', d: 'Zet per dag exact van–tot. Shiftwerkers gebruiken een vaste week als sjabloon.' },
            { n: '03', t: 'Match & ga', d: 'Jobs in de buurt waarvan de uren overlappen. Jij zegt ja — daarna heb je een shiftkaart.' },
          ].map((s) => (
            <div key={s.n} className="rounded-2xl bg-white p-6 shadow-[0_10px_30px_rgba(17,17,17,0.06)]">
              <div className="text-sm font-bold text-terra">{s.n}</div>
              <h3 className="mt-2 text-xl font-bold tracking-tight">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.d}</p>
              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                <div className="h-full rounded-full bg-terra" style={{ width: s.n === '01' ? '40%' : s.n === '02' ? '70%' : '100%' }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-8">
        <p className="font-script text-3xl text-terra">Zo ziet de app eruit</p>
        <h2 className="text-3xl font-extrabold tracking-tight">Kalender, shiftkaart, loon — geen scores</h2>
        <div className="mt-8 grid items-start gap-6 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-line bg-white p-4 shadow-[0_18px_40px_rgba(17,17,17,0.08)] sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted">Kalender · augustus</div>
                <div className="mt-0.5 text-lg font-extrabold tracking-tight">Emma’s week</div>
              </div>
              <div className="flex gap-2 text-[11px] font-medium">
                <span className="rounded-md border border-terra/50 bg-terra/20 px-2 py-0.5">Vrij</span>
                <span className="rounded-md bg-ink px-2 py-0.5 text-white">Gepland</span>
                <span className="rounded-md border border-emerald-700/40 bg-emerald-50 px-2 py-0.5 text-emerald-950">
                  Gedaan
                </span>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {[
                { d: 'Ma', kind: 'open' as const, n: '17' },
                { d: 'Di', kind: 'open' as const, n: '18' },
                { d: 'Wo', kind: 'worked' as const, n: '19' },
                { d: 'Do', kind: 'planned' as const, n: '20' },
                { d: 'Vr', kind: 'open' as const, n: '21' },
                { d: 'Za', kind: 'empty' as const, n: '22' },
                { d: 'Zo', kind: 'empty' as const, n: '23' },
              ].map((c) => (
                <div
                  key={c.d}
                  className={`min-h-[88px] rounded-xl border p-2 ${
                    c.kind === 'planned'
                      ? 'border-ink bg-ink text-white'
                      : c.kind === 'worked'
                        ? 'border-emerald-700/35 bg-emerald-50 text-emerald-950'
                        : c.kind === 'open'
                          ? 'border-terra/50 bg-terra/20'
                          : 'border-line bg-zinc-50 text-muted'
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wide opacity-70">{c.d}</div>
                  <div className="mt-0.5 text-sm font-semibold">{c.n}</div>
                  {c.kind === 'planned' && <div className="mt-3 text-[10px] leading-tight">18–23u De Kroon</div>}
                  {c.kind === 'worked' && <div className="mt-3 text-[10px] font-semibold">✓ bar</div>}
                  {c.kind === 'open' && <div className="mt-3 text-[10px]">vrij</div>}
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl bg-white p-5 shadow-[0_10px_30px_rgba(17,17,17,0.06)]">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Jouw shift</div>
              <h3 className="mt-1 text-xl font-bold tracking-tight">Bediening avondshift</h3>
              <p className="mt-1 text-sm text-muted">Café De Kroon · Vrijdagmarkt 12, Gent · 18:00–23:00</p>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Zwarte kleding, schone schoenen. Ingang via de zijdeur. Meld je bij Annelies.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white">Route Google Maps</span>
                <span className="rounded-lg border border-line px-3 py-2 text-xs font-semibold">Ik ben onderweg</span>
              </div>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-[0_10px_30px_rgba(17,17,17,0.06)]">
              <h3 className="text-xl font-bold tracking-tight">Deze week bij de zaak</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Emma vrijdag 18–23u · indicatieve loonkost in één oogopslag · uren exporteren voor de boekhouder.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-8">
        <div className="overflow-hidden rounded-3xl bg-zinc-50 p-5 shadow-inner sm:p-8">
          <div className="mb-6">
            <div className="text-sm font-medium text-muted">Vaste week van Emma · verpleegkundige in shiften</div>
            <div className="mt-1 text-2xl font-extrabold tracking-tight">Wanneer ben ik vrij?</div>
            <p className="mt-2 max-w-xl text-sm text-muted">
              Geen vage kleurblokjes: per dag zie je ochtend, namiddag of avond — met de uren erbij.
            </p>
          </div>
          <div className="rounded-2xl bg-white p-2 sm:p-4">
            <RecurringWeekPreview recurring={emma.recurring} />
          </div>
        </div>
      </section>

      <section id="mensen" className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <p className="font-script text-3xl text-terra">Klaar om in te vallen</p>
        <h2 className="text-3xl font-extrabold tracking-tight">Mensen die nu klaarstaan</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SEEKERS.slice(0, 6).map((s) => (
            <OpenSeekerProfile
              key={s.id}
              seeker={s}
              className="rounded-2xl bg-white p-5 text-left shadow-[0_10px_30px_rgba(17,17,17,0.06)] transition-colors hover:border-terra/40"
            >
              <div className="flex items-start gap-3">
                <Avatar name={s.name} hue={s.hue} photo={s.photo} />
                <div className="min-w-0">
                  <div className="font-bold hover:underline">{s.name}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                    <Icon name="pin" className="h-3.5 w-3.5" /> {s.city}
                    {s.lastMinute && (
                      <span className="badge-accent ml-1 rounded-md px-1.5 py-0.5 font-medium">
                        last-minute
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-muted">{s.bio}</p>
              <div className="mt-3">
                <SlotPills
                  slots={[...new Set(Object.values(s.recurring).flat())].slice(0, 4) as Slot[]}
                />
              </div>
            </OpenSeekerProfile>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-ink px-6 py-14 text-cream sm:px-12">
          <div className="blob pointer-events-none absolute -right-10 -top-16 h-56 w-56 bg-terra" />
          <div className="blob-alt blob-dots pointer-events-none absolute -bottom-10 left-10 h-32 w-32 bg-zinc-800" />
          <div className="relative">
            <p className="font-script text-3xl text-terra">Klaar wanneer jij bent</p>
            <h2 className="max-w-xl text-3xl font-extrabold tracking-tight sm:text-4xl">
              Vanavond nog iemand vinden — of gevonden worden.
            </h2>
            <p className="mt-4 max-w-lg text-cream/70">
              Maak een echt account. Je data blijft bewaard, en je krijgt e-mail bij aanvragen en berichten.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <PrimaryButton onClick={() => openAuth('signup', 'seeker')}>Account als werknemer</PrimaryButton>
              <button
                type="button"
                onClick={() => openAuth('signup', 'employer')}
                className="rounded-lg bg-white px-5 py-3 text-sm font-bold text-ink transition-all hover:-translate-y-0.5"
              >
                Account als zaak
              </button>
            </div>
            <p className="mt-6 text-xs text-cream/50">
              Demo:{' '}
              <button type="button" className="underline" onClick={onDemoSeeker}>
                Emma
              </button>
              {' · '}
              <button type="button" className="underline" onClick={onDemoEmployer}>
                Café De Kroon
              </button>
            </p>
          </div>
        </div>
        <p className="mt-10 text-center text-xs text-muted">
          FlexiShift is een matchingtool, geen juridisch advies.{' '}
          <a href="#wie" className="underline hover:text-ink">
            Wie mag een flexi-job?
          </a>
          {' · '}
          <button type="button" onClick={onReset} className="underline hover:text-ink">
            Demo resetten
          </button>
        </p>
      </section>
      <AuthModal
        open={authOpen}
        mode={authMode}
        role={authRole}
        onClose={() => setAuthOpen(false)}
        onMode={setAuthMode}
        onRole={setAuthRole}
      />
    </div>
  )
}

export { Logo } from './Mascot'

