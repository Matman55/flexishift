import { useMemo, useState } from 'react'
import { WEEKDAY_META, formatDateLong, isoDate } from './constants'
import { cardClass, Chip, GhostButton, PrimaryButton, inputClass } from './components'
import { weekdayFromIso } from './data'
import { hoursOnDate } from './match'
import {
  TIME_OPTIONS,
  TIME_PRESETS,
  calendarDates,
  emptyDayHours,
  formatRange,
  hasPreset,
  isDayOpen,
  isPastDate,
  togglePreset,
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

export function AvailabilityCalendar({
  seeker,
  shifts = [],
  onChange,
  onApplyWeek,
}: {
  seeker: Seeker
  shifts?: CalendarShift[]
  onChange: (date: string, hours: DayHours | null) => void
  onApplyWeek: () => void
}) {
  const dates = useMemo(() => calendarDates(6), [])
  const today = isoDate(0)
  const [selected, setSelected] = useState(today)
  const selectedHours = hoursOnDate(seeker, selected)
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
  const monthTitle = useMemo(() => {
    const first = new Date(dates[0] + 'T12:00:00')
    const last = new Date(dates[dates.length - 1] + 'T12:00:00')
    const a = first.toLocaleDateString('nl-BE', { month: 'long', year: 'numeric' })
    const b = last.toLocaleDateString('nl-BE', { month: 'long', year: 'numeric' })
    return a === b ? a : `${a} – ${b}`
  }, [dates])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold capitalize tracking-tight">{monthTitle}</h3>
        <div className="flex flex-wrap gap-3 text-[11px] font-medium text-muted">
          <Legend swatch="bg-terra/30 border-terra/50" label="Vrij" />
          <Legend swatch="bg-ink border-ink" label="Gepland" />
          <Legend swatch="bg-terra/20 border-ink" label="Vrij + job" />
          <Legend swatch="bg-white border-line" label="Niet vrij" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="mb-2 grid grid-cols-7 text-center text-[11px] font-bold uppercase tracking-wide text-muted">
            {(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).map((d) => (
              <div key={d}>{WEEKDAY_META[d].short}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {dates.map((date) => {
              const hours = hoursOnDate(seeker, date)
              const open = isDayOpen(hours)
              const dayShifts = byDate[date] ?? []
              const booked = dayShifts.length > 0
              const isSel = date === selected
              const isToday = date === today
              const disabled = isPastDate(date)
              return (
                <button
                  key={date}
                  type="button"
                  disabled={disabled}
                  onClick={() => setSelected(date)}
                  className={`min-h-[92px] rounded-xl border p-1.5 text-left transition ${
                    disabled
                      ? 'cursor-not-allowed border-transparent bg-zinc-50 text-zinc-300'
                      : isSel
                        ? booked && !open
                          ? 'border-ink bg-ink text-white shadow-sm ring-2 ring-terra'
                          : 'border-ink bg-terra/45 shadow-sm ring-2 ring-ink/20'
                        : booked && open
                          ? 'border-ink bg-terra/20 hover:bg-terra/30'
                          : booked
                            ? 'border-ink bg-ink text-white hover:bg-zinc-800'
                            : open
                              ? 'border-terra/50 bg-terra/20 hover:bg-terra/30'
                              : 'border-line bg-white hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-sm font-bold">
                      {Number(date.slice(8))}
                    </span>
                    {isToday && !disabled && (
                      <span className={`text-[9px] font-semibold uppercase ${booked && !open && !isSel ? 'text-terra' : 'text-muted'}`}>
                        nu
                      </span>
                    )}
                  </div>
                  {!disabled && booked && (
                    <div className={`mt-1 line-clamp-2 text-[10px] font-semibold leading-tight ${booked && !open && !isSel ? 'text-terra' : ''}`}>
                      {dayShifts[0].startTime
                        ? `${dayShifts[0].startTime} ${dayShifts[0].title}`
                        : dayShifts[0].title}
                    </div>
                  )}
                  {!disabled && open && (
                    <div className={`mt-1 line-clamp-2 text-[10px] font-medium leading-tight ${booked ? 'opacity-80' : 'text-ink/80'}`}>
                      {booked ? 'Nog vrij · ' : ''}
                      {hours.flexible ? 'flexibel' : hours.ranges.map((r) => formatRange(r)).join(' ')}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className={`${cardClass} p-5`}>
          <div className="text-xs font-medium uppercase tracking-wide text-muted">
            {WEEKDAY_META[weekdayFromIso(selected)].long}
          </div>
          <h3 className="text-lg font-bold tracking-tight">{formatDateLong(selected)}</h3>
          {past ? (
            <p className="mt-3 text-sm text-muted">Deze dag is al voorbij.</p>
          ) : (
            <>
              {selectedShifts.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted">Gepland</div>
                  {selectedShifts.map((s) => (
                    <div key={s.id} className="rounded-xl bg-ink px-3 py-2.5 text-white">
                      <div className="text-[11px] font-medium text-terra">Bevestigde shift</div>
                      <div className="mt-0.5 font-semibold">{s.title}</div>
                      <div className="text-sm text-white/70">
                        {s.company}
                        {s.startTime ? ` · ${s.startTime}–${s.endTime}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className={selectedShifts.length > 0 ? 'mt-5' : ''}>
                {selectedShifts.length > 0 && (
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                    Nog vrij die dag
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
          <GhostButton onClick={onApplyWeek} className="mt-5 w-full !py-2.5 text-xs">
            Vaste week toepassen op deze kalender
          </GhostButton>
        </div>
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
            onChange(
              value.flexible ? emptyDayHours() : { ranges: [], flexible: true },
            )
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
                <p className="text-sm text-muted">Nog geen uren. Kies een preset of voeg een tijdblok toe.</p>
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
