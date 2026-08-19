import { useEffect, useMemo, useRef, useState } from 'react'
import { WEEKDAY_META, isoDate } from './constants'
import { GhostButton, Icon } from './components'
import { weekdayFromIso } from './data'
import { addDaysIso, fromMinutes, isPastDate, monthGrid, shiftYearMonth, toMinutes, weekDates } from './time'

export type ScheduleEvent = {
  id: string
  date: string
  title: string
  subtitle?: string
  startTime?: string
  endTime?: string
  tone: 'free' | 'asked' | 'planned' | 'worked'
  kind?: 'job' | 'person'
}

export type ScheduleSlot = {
  date: string
  startTime: string
  endTime: string
}

function slotFromDay(date: string): ScheduleSlot {
  return { date, startTime: '18:00', endTime: '23:00' }
}

function slotFromHour(date: string, hour: number): ScheduleSlot {
  const start = fromMinutes(hour * 60)
  const end = fromMinutes(Math.min(24 * 60, (hour + 4) * 60))
  return { date, startTime: start, endTime: end }
}

function tryCreate(
  date: string,
  onCreate: ((slot: ScheduleSlot) => void) | undefined,
  slot: ScheduleSlot,
) {
  if (!onCreate || isPastDate(date)) return
  onCreate(slot)
}

type CalView = 'month' | 'week' | 'day'

const HOUR_H = 52
const GRID_START = 0
const GRID_END = 24
const SCROLL_TO_HOUR = 6
const HOURS = Array.from({ length: GRID_END - GRID_START }, (_, i) => GRID_START + i)

function layoutRange(startTime: string, endTime: string): { top: number; height: number } | null {
  const start = Math.max(toMinutes(startTime), GRID_START * 60)
  const end = Math.min(toMinutes(endTime), GRID_END * 60)
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

function toneClass(tone: ScheduleEvent['tone']): string {
  if (tone === 'asked') return 'border border-ink bg-white text-ink shadow-sm'
  if (tone === 'planned') return 'bg-ink text-white'
  if (tone === 'worked') return 'bg-emerald-700 text-white'
  return 'border border-terra/50 bg-terra/40 text-ink'
}

function EventInner({ e, showSubtitle }: { e: ScheduleEvent; showSubtitle?: boolean }) {
  const found = e.kind === 'person'
  return (
    <>
      <div className="flex min-w-0 items-start gap-1">
        {found && <Icon name="check" className="mt-px h-3 w-3 shrink-0" />}
        <span className={`min-w-0 truncate ${found ? 'underline decoration-current/50 underline-offset-2' : ''}`}>
          {e.title}
        </span>
      </div>
      {showSubtitle && e.subtitle && (
        <div className={`${found ? 'pl-4' : ''} truncate text-[10px] font-medium opacity-80`}>{e.subtitle}</div>
      )}
    </>
  )
}

function eventLabel(e: ScheduleEvent): string {
  return e.startTime ? `${e.startTime} ${e.title}` : e.title
}

function assignLanes(events: ScheduleEvent[]): Map<string, { lane: number; lanes: number }> {
  const timed = events
    .filter((e) => e.startTime && e.endTime)
    .map((e) => ({
      id: e.id,
      start: toMinutes(e.startTime!),
      end: toMinutes(e.endTime!),
    }))
    .sort((a, b) => a.start - b.start || a.end - b.end)
  const lanes: { end: number }[] = []
  const placed = new Map<string, number>()
  for (const ev of timed) {
    let lane = lanes.findIndex((l) => l.end <= ev.start)
    if (lane < 0) {
      lane = lanes.length
      lanes.push({ end: ev.end })
    } else {
      lanes[lane].end = ev.end
    }
    placed.set(ev.id, lane)
  }
  const n = Math.max(1, lanes.length)
  const out = new Map<string, { lane: number; lanes: number }>()
  for (const [id, lane] of placed) out.set(id, { lane, lanes: n })
  return out
}

export function ScheduleCalendar({
  events,
  defaultView = 'week',
  onSelectEvent,
  onCreate,
  onSelectDay,
  legend,
}: {
  events: ScheduleEvent[]
  defaultView?: CalView
  onSelectEvent?: (id: string) => void
  onCreate?: (slot: ScheduleSlot) => void
  onSelectDay?: (date: string) => void
  legend?: { swatch: string; label: string }[]
}) {
  const today = isoDate(0)
  const [view, setView] = useState<CalView>(defaultView)
  const [selected, setSelected] = useState(today)
  const byDate = useMemo(() => {
    const map: Record<string, ScheduleEvent[]> = {}
    for (const e of events) {
      ;(map[e.date] ??= []).push(e)
    }
    return map
  }, [events])
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
      else setSelected(delta > 0 ? first : last)
      return
    }
    setSelected(addDaysIso(selected, view === 'week' ? delta * 7 : delta))
  }

  const openDay = (date: string) => {
    setSelected(date)
    if (onSelectDay) {
      onSelectDay(date)
      return
    }
    setView('day')
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <GhostButton onClick={() => setSelected(today)} className="!py-2 !text-xs">
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
            {onCreate && (
              <GhostButton
                className="!py-2 !text-xs"
                onClick={() => tryCreate(isoDate(0), onCreate, slotFromDay(isoDate(0)))}
              >
                + Nieuwe job
              </GhostButton>
            )}
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
          {(
            legend ?? [
              { swatch: 'bg-terra/40 border-terra/50', label: 'Nog open' },
              { swatch: 'bg-white border-ink', label: 'Gevraagd — tik de naam voor het profiel' },
              { swatch: 'bg-ink border-ink', label: 'Bevestigd' },
              { swatch: 'bg-emerald-700 border-emerald-700', label: 'Gewerkt' },
            ]
          ).map((item) => (
            <Legend key={item.label} swatch={item.swatch} label={item.label} />
          ))}
          {onCreate && <span className="text-muted">Tik op een lege plek om een job te zetten.</span>}
        </div>
      </div>

      {view === 'month' && (
        <MonthView
          cells={cells}
          today={today}
          selected={selected}
          byDate={byDate}
          onSelect={setSelected}
          onOpenDay={openDay}
          onSelectEvent={onSelectEvent}
          onCreate={onCreate}
        />
      )}
      {(view === 'week' || view === 'day') && (
        <TimedView
          dates={view === 'week' ? week : [selected]}
          today={today}
          selected={selected}
          byDate={byDate}
          onSelect={setSelected}
          onOpenDay={openDay}
          onSelectEvent={onSelectEvent}
          onCreate={onCreate}
        />
      )}
    </div>
  )
}

function MonthView({
  cells,
  today,
  selected,
  byDate,
  onSelect,
  onOpenDay,
  onSelectEvent,
  onCreate,
}: {
  cells: { date: string; inMonth: boolean }[]
  today: string
  selected: string
  byDate: Record<string, ScheduleEvent[]>
  onSelect: (date: string) => void
  onOpenDay: (date: string) => void
  onSelectEvent?: (id: string) => void
  onCreate?: (slot: ScheduleSlot) => void
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
          const dayEvents = byDate[cell.date] ?? []
          const shown = dayEvents.slice(0, 3)
          const extra = dayEvents.length - shown.length
          const isSel = cell.date === selected
          const isToday = cell.date === today
          return (
            <div
              key={cell.date}
              role="button"
              tabIndex={0}
              onClick={() => {
                onSelect(cell.date)
                if (onCreate) tryCreate(cell.date, onCreate, slotFromDay(cell.date))
                else onOpenDay(cell.date)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(cell.date)
                  if (onCreate) tryCreate(cell.date, onCreate, slotFromDay(cell.date))
                }
              }}
              className={`min-h-[108px] cursor-pointer border-b border-r border-line p-1.5 hover:bg-zinc-50 ${
                !cell.inMonth ? 'bg-zinc-50/80' : isSel ? 'bg-terra/10' : 'bg-white'
              }`}
            >
              <div
                className={`grid h-7 w-7 place-items-center rounded-full text-sm font-semibold ${
                  isToday
                    ? 'bg-terra text-ink'
                    : !cell.inMonth
                      ? 'text-zinc-400'
                      : isSel
                        ? 'bg-ink text-white'
                        : 'text-ink'
                }`}
              >
                {Number(cell.date.slice(8))}
              </div>
              <div className="mt-1 space-y-0.5">
                {shown.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation()
                      onSelect(cell.date)
                      onSelectEvent?.(e.id)
                    }}
                    className={`block w-full rounded px-1 py-0.5 text-left text-[10px] font-semibold leading-tight ${toneClass(e.tone)}`}
                    aria-label={e.kind === 'person' ? `Profiel van ${e.title}` : eventLabel(e)}
                  >
                    <EventInner e={e} />
                  </button>
                ))}
                {extra > 0 && (
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation()
                      onOpenDay(cell.date)
                    }}
                    className="px-1 text-[10px] font-semibold text-muted"
                  >
                    +{extra} meer
                  </button>
                )}
              </div>
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
  byDate,
  onSelect,
  onOpenDay,
  onSelectEvent,
  onCreate,
}: {
  dates: string[]
  today: string
  selected: string
  byDate: Record<string, ScheduleEvent[]>
  onSelect: (date: string) => void
  onOpenDay: (date: string) => void
  onSelectEvent?: (id: string) => void
  onCreate?: (slot: ScheduleSlot) => void
}) {
  const now = new Date()
  const nowMins = now.getHours() * 60 + now.getMinutes()
  const showNow = dates.includes(today) && nowMins >= GRID_START * 60 && nowMins < GRID_END * 60
  const nowTop = ((nowMins - GRID_START * 60) / 60) * HOUR_H
  const wide = dates.length === 1
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = SCROLL_TO_HOUR * HOUR_H
  }, [dates.join(',')])

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white">
      <div className={dates.length > 1 ? 'min-w-[720px]' : undefined}>
        <div
          className="grid border-b border-line"
          style={{ gridTemplateColumns: `3.5rem repeat(${dates.length}, minmax(0, 1fr))` }}
        >
          <div />
          {dates.map((date) => {
            const isToday = date === today
            const isSel = date === selected
            const d = new Date(`${date}T12:00:00`)
            return (
              <button
                key={date}
                type="button"
                onClick={() => {
                  if (onCreate) tryCreate(date, onCreate, slotFromDay(date))
                  else if (wide) onSelect(date)
                  else onOpenDay(date)
                }}
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

        <div
          className="grid border-b border-line"
          style={{ gridTemplateColumns: `3.5rem repeat(${dates.length}, minmax(0, 1fr))` }}
        >
          <div className="px-1 py-1 text-[10px] font-medium text-muted">Hele dag</div>
          {dates.map((date) => {
            const allday = (byDate[date] ?? []).filter((e) => !e.startTime)
            return (
              <button
                key={date}
                type="button"
                onClick={() => {
                  onSelect(date)
                  if (onCreate) tryCreate(date, onCreate, slotFromDay(date))
                }}
                className="min-h-[40px] space-y-0.5 border-l border-line px-1 py-1 text-left hover:bg-terra/10"
              >
                {allday.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    className={`block w-full rounded px-1 py-0.5 text-left text-[10px] font-semibold ${toneClass(e.tone)}`}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      onSelectEvent?.(e.id)
                    }}
                    aria-label={e.kind === 'person' ? `Profiel van ${e.title}` : e.title}
                  >
                    <EventInner e={e} />
                  </button>
                ))}
              </button>
            )
          })}
        </div>

        <div ref={scrollRef} className="max-h-[640px] overflow-auto">
          <div
            className="grid"
            style={{ gridTemplateColumns: `3.5rem repeat(${dates.length}, minmax(0, 1fr))` }}
          >
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
              const dayEvents = (byDate[date] ?? []).filter((e) => e.startTime && e.endTime)
              const lanes = assignLanes(dayEvents)
              const isToday = date === today
              return (
                <div
                  key={date}
                  className={`relative border-l border-line ${date === selected ? 'bg-terra/5' : ''}`}
                  style={{ height: HOURS.length * HOUR_H }}
                  onClick={() => {
                    onSelect(date)
                    if (!onCreate) onOpenDay(date)
                  }}
                >
                  {HOURS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation()
                        onSelect(date)
                        if (onCreate) tryCreate(date, onCreate, slotFromHour(date, h))
                        else onOpenDay(date)
                      }}
                      className="absolute left-0 right-0 border-t border-line/80 hover:bg-terra/15"
                      style={{ top: (h - GRID_START) * HOUR_H, height: HOUR_H }}
                      aria-label={`Nieuwe job ${date} ${String(h).padStart(2, '0')}:00`}
                    />
                  ))}
                  {dayEvents.map((e) => {
                    const box = layoutRange(e.startTime!, e.endTime!)
                    if (!box) return null
                    const lane = lanes.get(e.id) ?? { lane: 0, lanes: 1 }
                    const width = `${100 / lane.lanes}%`
                    const left = `${(lane.lane / lane.lanes) * 100}%`
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation()
                          onSelect(date)
                          onSelectEvent?.(e.id)
                        }}
                        className={`absolute z-10 overflow-hidden rounded-md px-1.5 py-0.5 text-left text-[11px] font-semibold leading-tight ${toneClass(e.tone)}`}
                        style={{
                          top: box.top,
                          height: box.height,
                          left,
                          width,
                          paddingLeft: 6,
                          paddingRight: 4,
                        }}
                        aria-label={e.kind === 'person' ? `Profiel van ${e.title}` : e.title}
                      >
                        <EventInner e={e} showSubtitle={wide} />
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

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded-sm border ${swatch}`} />
      {label}
    </span>
  )
}
