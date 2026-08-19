import { useMemo, useState } from 'react'
import { WEEKDAY_META, formatDateLong, isoDate } from './constants'
import { cardClass, Chip, GhostButton, Icon, PrimaryButton, inputClass } from './components'
import { weekdayFromIso } from './data'
import { hoursOnDate, plannedHoursOnDate } from './match'
import {
  TIME_OPTIONS,
  TIME_PRESETS,
  addDaysIso,
  emptyDayHours,
  formatDayHours,
  formatRange,
  fromMinutes,
  hasPreset,
  isDayOpen,
  isPastDate,
  mergeRanges,
  monthGrid,
  shiftYearMonth,
  toMinutes,
  togglePreset,
  weekDates,
} from './time'
import type { DayHours, Seeker, TimeRange } from './types'

export type CalendarShift = {
  id: string
  date: string
  title: string
  company: string
  startTime?: string
  endTime?: string
}

type CalView = 'month' | 'week' | 'day'

const HOUR_H = 52
const GRID_START = 6
const GRID_END = 24
const HOURS = Array.from({ length: GRID_END - GRID_START }, (_, i) => GRID_START + i)

function bookedRangesFromShifts(shifts: CalendarShift[]): TimeRange[] {
  return shifts.map((s) =>
    s.startTime && s.endTime
      ? { start: s.startTime, end: s.endTime }
      : { start: '00:00', end: '24:00' },
  )
}

function shiftLabel(s: CalendarShift): string {
  return s.startTime ? `${s.startTime} ${s.title}` : s.title
}

function layoutRange(range: TimeRange): { top: number; height: number } | null {
  const start = Math.max(toMinutes(range.start), GRID_START * 60)
  const end = Math.min(toMinutes(range.end), GRID_END * 60)
  if (end <= start) return null
  return {
    top: ((start - GRID_START * 60) / 60) * HOUR_H,
    height: Math.max(22, ((end - start) / 60) * HOUR_H - 2),
  }
}

function periodTitle(view: CalView, selected: string): string {
  const d = new Date(`${selected}T12:00:00`)
  if (view === 'day') {
    return d.toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }
  if (view === 'week') {
    const days = weekDates(selected)
    const a = new Date(`${days[0]}T12:00:00`)
    const b = new Date(`${days[6]}T12:00:00`)
    const sameMonth = a.getMonth() === b.getMonth()
    const left = a.toLocaleDateString('nl-BE', { day: 'numeric', month: sameMonth ? undefined : 'short' })
    const right = b.toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' })
    return `${left} – ${right}`
  }
  return d.toLocaleDateString('nl-BE', { month: 'long', year: 'numeric' })
}

export function AvailabilityCalendar({
  seeker,
  shifts = [],
  onChange,
  onApplyWeek,
}: {
  seeker: Seeker
  shifts?: CalendarShift[]
  onChange: (date: string, hours: DayHours | null) => void
  onApplyWeek: (dates: string[]) => void
}) {
  const today = isoDate(0)
  const [view, setView] = useState<CalView>('month')
  const [selected, setSelected] = useState(today)
  const selectedHours = plannedHoursOnDate(seeker, selected)
  const custom = Object.prototype.hasOwnProperty.call(seeker.hours ?? {}, selected)
  const past = isPastDate(selected)
  const byDate = useMemo(() => {
    const map: Record<string, CalendarShift[]> = {}
    for (const s of shifts) {
      ;(map[s.date] ??= []).push(s)
    }
    return map
  }, [shifts])
  const selectedShifts = byDate[selected] ?? []
  const remainingHours = hoursOnDate(seeker, selected, bookedRangesFromShifts(selectedShifts))
  const year = Number(selected.slice(0, 4))
  const month = Number(selected.slice(5, 7)) - 1
  const cells = useMemo(() => monthGrid(year, month), [year, month])
  const week = useMemo(() => weekDates(selected), [selected])

  const go = (delta: number) => {
    if (view === 'month') {
      const next = shiftYearMonth(year, month, delta)
      const first = `${next.year}-${String(next.month + 1).padStart(2, '0')}-01`
      const lastDay = new Date(next.year, next.month + 1, 0).getDate()
      const last = `${next.year}-${String(next.month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      if (today >= first && today <= last) setSelected(today)
      else if (delta > 0) setSelected(first)
      else setSelected(last)
      return
    }
    setSelected(addDaysIso(selected, view === 'week' ? delta * 7 : delta))
  }

  const goToday = () => setSelected(today)

  const openDay = (date: string) => {
    setSelected(date)
    setView('day')
  }

  const onHourClick = (date: string, hour: number) => {
    setSelected(date)
    if (isPastDate(date)) return
    const current = plannedHoursOnDate(seeker, date)
    if (current.flexible) return
    const start = fromMinutes(hour * 60)
    const end = fromMinutes(Math.min(24 * 60, (hour + 1) * 60))
    onChange(date, {
      flexible: false,
      ranges: mergeRanges([...current.ranges, { start, end }]),
    })
  }

  const applyDates =
    view === 'week'
      ? week.filter((d) => !isPastDate(d))
      : cells.filter((c) => c.inMonth && !isPastDate(c.date)).map((c) => c.date)

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <GhostButton onClick={goToday} className="!py-2 !text-xs">
              Vandaag
            </GhostButton>
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => go(-1)}
                className="grid h-9 w-9 place-items-center rounded-lg hover:bg-zinc-50"
                aria-label="Vorige"
              >
                <Icon name="chevron" className="h-4 w-4 rotate-180" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                className="grid h-9 w-9 place-items-center rounded-lg hover:bg-zinc-50"
                aria-label="Volgende"
              >
                <Icon name="chevron" className="h-4 w-4" />
              </button>
            </div>
            <h3 className="text-lg font-semibold capitalize tracking-tight">{periodTitle(view, selected)}</h3>
          </div>
          <div className="inline-flex rounded-lg border border-line p-0.5">
            {(
              [
                ['month', 'Maand'],
                ['week', 'Week'],
                ['day', 'Dag'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                  view === id ? 'bg-ink text-white' : 'text-muted hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-[11px] font-medium text-muted">
          <Legend swatch="bg-terra/30 border-terra/50" label="Vrij" />
          <Legend swatch="bg-ink border-ink" label="Gepland" />
          <Legend swatch="bg-emerald-50 border-emerald-700/40" label="Gewerkt" />
          <Legend swatch="bg-white border-line" label="Niet vrij" />
        </div>
      </div>

      {view === 'month' && (
        <MonthView
          cells={cells}
          today={today}
          selected={selected}
          seeker={seeker}
          byDate={byDate}
          onSelect={setSelected}
          onOpenDay={openDay}
        />
      )}
      {view === 'week' && (
        <TimedView
          dates={week}
          today={today}
          selected={selected}
          seeker={seeker}
          byDate={byDate}
          onSelect={setSelected}
          onOpenDay={openDay}
          onHourClick={onHourClick}
        />
      )}
      {view === 'day' && (
        <TimedView
          dates={[selected]}
          today={today}
          selected={selected}
          seeker={seeker}
          byDate={byDate}
          onSelect={setSelected}
          onOpenDay={openDay}
          onHourClick={onHourClick}
        />
      )}

      <div className={`${cardClass} mt-6 p-5`}>
        <div className="text-xs font-medium uppercase tracking-wide text-muted">
          {WEEKDAY_META[weekdayFromIso(selected)].long}
        </div>
        <h3 className="text-lg font-bold tracking-tight">{formatDateLong(selected)}</h3>
        {past ? (
          selectedShifts.length > 0 ? (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-muted">Deze dag is voorbij. Dit heb je gewerkt:</p>
              {selectedShifts.map((s) => (
                <ShiftCard key={s.id} shift={s} tone="worked" />
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">Deze dag is al voorbij. Je hebt hier geen shift gewerkt.</p>
          )
        ) : (
          <>
            {selectedShifts.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted">Gepland</div>
                {selectedShifts.map((s) => (
                  <ShiftCard key={s.id} shift={s} tone="planned" />
                ))}
              </div>
            )}
            <div className={selectedShifts.length > 0 ? 'mt-5' : ''}>
              {selectedShifts.length > 0 && (
                <div className="mb-3 rounded-xl bg-zinc-50 px-3 py-2.5 text-sm leading-relaxed text-muted">
                  {isDayOpen(remainingHours) ? (
                    <>
                      <span className="font-medium text-ink">Nog vrij voor nieuwe jobs: </span>
                      {formatDayHours(remainingHours)}. De uren van je shift zijn geblokkeerd.
                    </>
                  ) : (
                    <span className="font-medium text-ink">
                      Deze dag is volgepland. Werkgevers zien je nu niet meer als vrij.
                    </span>
                  )}
                </div>
              )}
              <DayHoursEditor
                value={selectedHours}
                custom={custom}
                onChange={(hours) => onChange(selected, hours)}
                onReset={() => onChange(selected, null)}
              />
            </div>
          </>
        )}
        {view !== 'day' && (
          <GhostButton onClick={() => onApplyWeek(applyDates)} className="mt-5 w-full !py-2.5 text-xs">
            {view === 'week' ? 'Vaste week toepassen op deze week' : 'Vaste week toepassen op deze maand'}
          </GhostButton>
        )}
      </div>
    </div>
  )
}

function MonthView({
  cells,
  today,
  selected,
  seeker,
  byDate,
  onSelect,
  onOpenDay,
}: {
  cells: { date: string; inMonth: boolean }[]
  today: string
  selected: string
  seeker: Seeker
  byDate: Record<string, CalendarShift[]>
  onSelect: (date: string) => void
  onOpenDay: (date: string) => void
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="grid grid-cols-7 border-b border-line bg-zinc-50 text-center text-[11px] font-bold uppercase tracking-wide text-muted">
        {(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).map((d) => (
          <div key={d} className="px-1 py-2">
            {WEEKDAY_META[d].short}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          const date = cell.date
          const dayShifts = byDate[date] ?? []
          const bookedRanges = bookedRangesFromShifts(dayShifts)
          const hours = hoursOnDate(seeker, date, bookedRanges)
          const open = isDayOpen(hours)
          const pastDay = isPastDate(date)
          const isSel = date === selected
          const isToday = date === today
          const chips: { key: string; label: string; tone: 'free' | 'planned' | 'worked' }[] = []
          for (const s of dayShifts) {
            chips.push({
              key: s.id,
              label: shiftLabel(s),
              tone: pastDay ? 'worked' : 'planned',
            })
          }
          if (!pastDay && open) {
            chips.push({
              key: `${date}-free`,
              label: hours.flexible ? 'Flexibel' : hours.ranges.map((r) => formatRange(r)).join(' '),
              tone: 'free',
            })
          }
          const shown = chips.slice(0, 3)
          const extra = chips.length - shown.length
          return (
            <div
              key={date}
              className={`min-h-[108px] border-b border-r border-line p-1.5 text-left align-top hover:bg-zinc-50 ${
                !cell.inMonth ? 'bg-zinc-50/80' : isSel ? 'bg-terra/10' : 'bg-white'
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onOpenDay(date)}
                  className={`grid h-7 w-7 place-items-center rounded-full text-sm font-semibold ${
                    isToday
                      ? 'bg-terra text-ink'
                      : !cell.inMonth
                        ? 'text-zinc-400'
                        : isSel
                          ? 'bg-ink text-white'
                          : 'text-ink hover:bg-zinc-100'
                  }`}
                  aria-label={`Open ${formatDateLong(date)}`}
                >
                  {Number(date.slice(8))}
                </button>
              </div>
              <button
                type="button"
                onClick={() => onSelect(date)}
                className="block w-full space-y-0.5 text-left"
              >
                {shown.map((c) => (
                  <div
                    key={c.key}
                    className={`truncate rounded px-1 py-0.5 text-[10px] font-semibold leading-tight ${
                      c.tone === 'planned'
                        ? 'bg-ink text-white'
                        : c.tone === 'worked'
                          ? 'bg-emerald-700 text-white'
                          : 'border border-terra/50 bg-terra/35 text-ink'
                    }`}
                  >
                    {c.label}
                  </div>
                ))}
                {extra > 0 && (
                  <div className="px-1 text-[10px] font-semibold text-muted">+{extra} meer</div>
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TimedView({
  dates,
  today,
  selected,
  seeker,
  byDate,
  onSelect,
  onOpenDay,
  onHourClick,
}: {
  dates: string[]
  today: string
  selected: string
  seeker: Seeker
  byDate: Record<string, CalendarShift[]>
  onSelect: (date: string) => void
  onOpenDay: (date: string) => void
  onHourClick: (date: string, hour: number) => void
}) {
  const now = new Date()
  const nowMins = now.getHours() * 60 + now.getMinutes()
  const showNow = dates.includes(today) && nowMins >= GRID_START * 60 && nowMins < GRID_END * 60
  const nowTop = ((nowMins - GRID_START * 60) / 60) * HOUR_H
  const wide = dates.length === 1

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white">
      <div className={dates.length > 1 ? 'min-w-[720px]' : undefined}>
      <div className="grid border-b border-line" style={{ gridTemplateColumns: `3.5rem repeat(${dates.length}, minmax(0, 1fr))` }}>
        <div />
        {dates.map((date) => {
          const isToday = date === today
          const isSel = date === selected
          const d = new Date(`${date}T12:00:00`)
          return (
            <button
              key={date}
              type="button"
              onClick={() => (wide ? onSelect(date) : onOpenDay(date))}
              className={`px-2 py-2 text-center ${isSel ? 'bg-terra/10' : ''}`}
            >
              <div className="text-[11px] font-bold uppercase tracking-wide text-muted">
                {WEEKDAY_META[weekdayFromIso(date)].short}
              </div>
              <div
                className={`mx-auto mt-1 grid h-8 w-8 place-items-center rounded-full text-sm font-semibold ${
                  isToday ? 'bg-terra text-ink' : isSel ? 'bg-ink text-white' : 'text-ink'
                }`}
              >
                {d.getDate()}
              </div>
            </button>
          )
        })}
      </div>

      <div className="grid border-b border-line" style={{ gridTemplateColumns: `3.5rem repeat(${dates.length}, minmax(0, 1fr))` }}>
        <div className="px-1 py-1 text-[10px] font-medium text-muted">Hele dag</div>
        {dates.map((date) => {
          const dayShifts = byDate[date] ?? []
          const hours = hoursOnDate(seeker, date, bookedRangesFromShifts(dayShifts))
          const alldayShifts = dayShifts.filter((s) => !s.startTime)
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelect(date)}
              className="min-h-[40px] space-y-0.5 border-l border-line px-1 py-1 text-left"
            >
              {hours.flexible && (
                <div className="truncate rounded px-1 py-0.5 text-[10px] font-semibold border border-terra/50 bg-terra/35">
                  Flexibel
                </div>
              )}
              {alldayShifts.map((s) => (
                <div
                  key={s.id}
                  className={`truncate rounded px-1 py-0.5 text-[10px] font-semibold ${
                    isPastDate(date) ? 'bg-emerald-700 text-white' : 'bg-ink text-white'
                  }`}
                >
                  {s.title}
                </div>
              ))}
            </button>
          )
        })}
      </div>

      <div className="max-h-[640px] overflow-auto">
        <div className="grid" style={{ gridTemplateColumns: `3.5rem repeat(${dates.length}, minmax(0, 1fr))` }}>
          <div className="relative" style={{ height: HOURS.length * HOUR_H }}>
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute right-1 -translate-y-2 text-[10px] font-medium text-muted"
                style={{ top: (h - GRID_START) * HOUR_H }}
              >
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>
          {dates.map((date) => {
            const dayShifts = (byDate[date] ?? []).filter((s) => s.startTime && s.endTime)
            const hours = hoursOnDate(seeker, date, bookedRangesFromShifts(byDate[date] ?? []))
            const isToday = date === today
            return (
              <div
                key={date}
                className={`relative border-l border-line ${date === selected ? 'bg-terra/5' : ''}`}
                style={{ height: HOURS.length * HOUR_H }}
              >
                {HOURS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => onHourClick(date, h)}
                    className="absolute left-0 right-0 border-t border-line/80 hover:bg-zinc-50/80"
                    style={{ top: (h - GRID_START) * HOUR_H, height: HOUR_H }}
                    aria-label={`${date} ${String(h).padStart(2, '0')}:00`}
                  />
                ))}
                {!hours.flexible &&
                  hours.ranges.map((range) => {
                    const box = layoutRange(range)
                    if (!box) return null
                    return (
                      <div
                        key={`${date}-${range.start}-${range.end}`}
                        className="pointer-events-none absolute left-1 right-1 overflow-hidden rounded-md border border-terra/50 bg-terra/40 px-1.5 py-0.5 text-[11px] font-semibold leading-tight text-ink"
                        style={{ top: box.top, height: box.height }}
                      >
                        {wide ? `Vrij ${formatRange(range)}` : formatRange(range)}
                      </div>
                    )
                  })}
                {dayShifts.map((s) => {
                  const box = layoutRange({ start: s.startTime!, end: s.endTime! })
                  if (!box) return null
                  const worked = isPastDate(date)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onSelect(date)}
                      className={`absolute left-1 right-1 z-10 overflow-hidden rounded-md px-1.5 py-0.5 text-left text-[11px] font-semibold leading-tight text-white ${
                        worked ? 'bg-emerald-700' : 'bg-ink'
                      }`}
                      style={{ top: box.top, height: box.height }}
                    >
                      <div className="truncate">{s.title}</div>
                      {wide && (
                        <div className="truncate text-[10px] font-medium text-white/75">
                          {s.company} · {s.startTime}–{s.endTime}
                        </div>
                      )}
                    </button>
                  )
                })}
                {showNow && isToday && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
                    style={{ top: nowTop }}
                  >
                    <span className="h-2.5 w-2.5 -translate-x-1 rounded-full bg-terra" />
                    <span className="h-0.5 flex-1 bg-terra" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
      </div>
    </div>
  )
}

function ShiftCard({
  shift,
  tone,
}: {
  shift: CalendarShift
  tone: 'planned' | 'worked'
}) {
  const worked = tone === 'worked'
  return (
    <div className={`rounded-xl px-3 py-2.5 ${worked ? 'bg-emerald-800 text-white' : 'bg-ink text-white'}`}>
      <div className={`text-[11px] font-medium ${worked ? 'text-emerald-100' : 'text-terra'}`}>
        {worked ? 'Afgeronde shift' : 'Bevestigde shift'}
      </div>
      <div className="mt-0.5 font-semibold">{shift.title}</div>
      <div className="text-sm text-white/70">
        {shift.company}
        {shift.startTime ? ` · ${shift.startTime}–${shift.endTime}` : ''}
      </div>
    </div>
  )
}

function Legend({
  swatch,
  label,
}: {
  swatch: string
  label: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded-sm border ${swatch}`} />
      {label}
    </span>
  )
}

function DayHoursEditor({
  value,
  custom,
  onChange,
  onReset,
}: {
  value: DayHours
  custom: boolean
  onChange: (hours: DayHours) => void
  onReset: () => void
}) {
  const addBlock = () => {
    onChange({
      flexible: false,
      ranges: [...value.ranges, { start: '09:00', end: '17:00' }],
    })
  }

  return (
    <div className="mt-4 space-y-4">
      <label className="flex items-center justify-between gap-3 rounded-xl bg-zinc-50 px-3 py-2.5">
        <span className="text-sm font-medium">Flexibel — maakt niet uit wanneer</span>
        <button
          type="button"
          onClick={() =>
            onChange(value.flexible ? emptyDayHours() : { ranges: [], flexible: true })
          }
          className={`h-7 w-11 rounded-full p-0.5 transition-colors ${value.flexible ? 'bg-terra' : 'bg-line'}`}
        >
          <span
            className={`block h-6 w-6 rounded-full bg-white shadow-sm transition ${value.flexible ? 'translate-x-4' : ''}`}
          />
        </button>
      </label>

      {!value.flexible && (
        <>
          <div>
            <div className="mb-2 text-sm font-medium">Snel kiezen</div>
            <div className="flex flex-wrap gap-2">
              {TIME_PRESETS.map((p) => (
                <Chip
                  key={p.label}
                  active={hasPreset(value, p.range)}
                  onClick={() => onChange(togglePreset(value, p.range))}
                >
                  {p.label}
                  <span className="ml-1 text-[11px] opacity-70">{formatRange(p.range)}</span>
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium">Exacte uren</div>
            <div className="space-y-2">
              {value.ranges.length === 0 && (
                <p className="text-sm text-muted">Nog geen uren. Kies een preset, of tik in de week- of dagweergave op een uur.</p>
              )}
              {value.ranges.map((range, i) => (
                <TimeBlockRow
                  key={`${range.start}-${range.end}-${i}`}
                  range={range}
                  onChange={(next) => {
                    const ranges = value.ranges.map((r, idx) => (idx === i ? next : r))
                    onChange({ flexible: false, ranges })
                  }}
                  onRemove={() =>
                    onChange({
                      flexible: false,
                      ranges: value.ranges.filter((_, idx) => idx !== i),
                    })
                  }
                />
              ))}
            </div>
            <button
              type="button"
              onClick={addBlock}
              className="mt-2 text-sm font-semibold text-ink underline decoration-terra decoration-2 underline-offset-4"
            >
              + Nog een tijdblok
            </button>
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <PrimaryButton
          onClick={() => onChange(emptyDayHours())}
          className="!bg-zinc-100 !py-2 !text-ink hover:!bg-zinc-200"
        >
          Dag leegmaken
        </PrimaryButton>
        {custom && (
          <GhostButton onClick={onReset} className="!py-2">
            Terug naar vaste week
          </GhostButton>
        )}
      </div>
    </div>
  )
}

function TimeBlockRow({
  range,
  onChange,
  onRemove,
}: {
  range: TimeRange
  onChange: (next: TimeRange) => void
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <select
        className={inputClass}
        value={range.start}
        onChange={(e) => onChange({ ...range, start: e.target.value })}
      >
        {TIME_OPTIONS.filter((t) => t !== '24:00').map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <span className="text-sm text-muted">tot</span>
      <select
        className={inputClass}
        value={range.end}
        onChange={(e) => onChange({ ...range, end: e.target.value })}
      >
        {TIME_OPTIONS.filter((t) => t !== '00:00' || range.end === '00:00').map((t) => (
          <option key={t} value={t}>
            {t === '24:00' ? '24:00' : t}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded-lg px-2 py-2 text-sm font-medium text-muted hover:bg-zinc-100 hover:text-ink"
      >
        ✕
      </button>
    </div>
  )
}

export function TimeRangePicker({
  start,
  end,
  onChange,
}: {
  start: string
  end: string
  onChange: (start: string, end: string) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {TIME_PRESETS.map((p) => (
          <Chip
            key={p.label}
            active={start === p.range.start && end === p.range.end}
            onClick={() => onChange(p.range.start, p.range.end)}
          >
            {p.label}
            <span className="ml-1 text-[11px] opacity-70">{formatRange(p.range)}</span>
          </Chip>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Van</span>
          <select
            className={inputClass}
            value={start}
            onChange={(e) => onChange(e.target.value, end)}
          >
            {TIME_OPTIONS.filter((t) => t !== '24:00').map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Tot</span>
          <select className={inputClass} value={end} onChange={(e) => onChange(start, e.target.value)}>
            {TIME_OPTIONS.filter((t) => t !== '00:00').map((t) => (
              <option key={t}>{t === '24:00' ? '24:00' : t}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}
