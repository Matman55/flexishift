import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { defaultContract, emptyRecurring, uid, ensureWorkplace, workplaceFromCity } from './constants'
import { EMPLOYERS, SEEKERS, seedJobs, weekdayFromIso } from './data'
import { dayHoursFromSlots, rangeFromSlots } from './time'
import type {
  AppState,
  DayHours,
  Employer,
  Job,
  Role,
  Seeker,
  Slot,
  Weekday,
  WorkRequest,
} from './types'

const KEY = 'flexishift-v2'

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppState
      if (parsed.seekers?.length && parsed.jobs?.length) {
        const seededById = Object.fromEntries(seedJobs().map((j) => [j.id, j]))
        return {
          ...parsed,
          seekers: parsed.seekers.map((s) => ({ ...s, hours: s.hours ?? {} })),
          employers: (parsed.employers?.length ? parsed.employers : EMPLOYERS).map((e) => ({
            ...e,
            onboardingDone: e.onboardingDone !== false,
            favorites: e.favorites ?? [],
            workplace: e.workplace ?? workplaceFromCity(e.city),
          })),
          jobs: parsed.jobs.map((j) => {
            let next = j
            if (!j.startTime || !j.endTime) {
              const t = rangeFromSlots(j.slots ?? ['avond'])
              next = { ...next, startTime: t.start, endTime: t.end }
            }
            if (!next.workplace?.lat || !next.workplace?.lng) {
              next = {
                ...next,
                workplace: seededById[j.id]?.workplace ?? workplaceFromCity(j.city),
              }
            } else {
              next = { ...next, workplace: ensureWorkplace(next) }
            }
            const seeded = seededById[j.id]
            return {
              ...next,
              contractKind: next.contractKind ?? seeded?.contractKind ?? defaultContract(next.sector),
              requiresLicense: next.requiresLicense ?? next.skills?.includes('Chauffeur') ?? false,
            }
          }),
        }
      }
    }
  } catch {
    /* ignore */
  }
  const jobs = seedJobs()
  const first = jobs[0]
  return {
    session: null,
    seekers: SEEKERS,
    employers: EMPLOYERS,
    jobs,
    requests: [
      {
        id: 'r-demo',
        jobId: 'j-1',
        employerId: 'e-kroon',
        seekerId: 's-emma',
        from: 'employer',
        message:
          'Emma, we zagen dat je vanavond vrij bent. Kun je invallen aan de bar? We hebben meteen iemand nodig.',
        status: 'pending',
        createdAt: new Date().toISOString(),
        date: first.date,
        slots: ['avond'],
        startTime: first.startTime,
        endTime: first.endTime,
        title: 'Bediening — collega ziek',
        city: 'Gent',
      },
    ],
  }
}

function persist(state: AppState) {
  localStorage.setItem(KEY, JSON.stringify(state))
}

type Store = AppState & {
  login: (role: Role, id?: string) => void
  logout: () => void
  startNewSeeker: () => void
  startNewEmployer: () => void
  updateSeeker: (id: string, patch: Partial<Seeker>) => void
  updateEmployer: (id: string, patch: Partial<Employer>) => void
  toggleFavorite: (employerId: string, seekerId: string) => void
  setRecurring: (id: string, day: Weekday, slots: Slot[]) => void
  setDayOverride: (id: string, date: string, slots: Slot[] | null) => void
  setDayHours: (id: string, date: string, hours: DayHours | null) => void
  applyRecurringHours: (id: string, dates: string[]) => void
  addJob: (job: Omit<Job, 'id' | 'status'>) => string
  addRequest: (req: Omit<WorkRequest, 'id' | 'createdAt' | 'status'>) => void
  setRequestStatus: (id: string, status: WorkRequest['status']) => void
  markRequestsRead: (role: Role, id: string) => void
  resetDemo: () => void
}

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(load)

  const commit = useCallback((updater: (prev: AppState) => AppState) => {
    setState((prev) => {
      const next = updater(prev)
      persist(next)
      return next
    })
  }, [])

  const login = useCallback(
    (role: Role, id?: string) => {
      commit((p) => ({
        ...p,
        session: {
          role,
          seekerId: role === 'seeker' ? (id ?? 's-emma') : p.session?.seekerId ?? 's-emma',
          employerId: role === 'employer' ? (id ?? 'e-kroon') : p.session?.employerId ?? 'e-kroon',
        },
      }))
    },
    [commit],
  )

  const logout = useCallback(() => {
    commit((p) => ({ ...p, session: null }))
  }, [commit])

  const startNewSeeker = useCallback(() => {
    const id = uid('s')
    const seeker: Seeker = {
      id,
      name: '',
      city: 'Gent',
      hue: Math.floor(Math.random() * 360),
      bio: '',
      sectors: [],
      skills: [],
      languages: ['Nederlands'],
      hasLicense: false,
      hasTransport: false,
      yearsExperience: 1,
      hourlyRateMin: 14,
      lastMinute: true,
      rating: 5,
      jobsDone: 0,
      recurring: emptyRecurring(),
      hours: {},
      overrides: {},
      blocked: [],
      onboardingDone: false,
    }
    commit((p) => ({
      ...p,
      seekers: [...p.seekers, seeker],
      session: { role: 'seeker', seekerId: id, employerId: 'e-kroon' },
    }))
  }, [commit])

  const startNewEmployer = useCallback(() => {
    const id = uid('e')
    const employer: Employer = {
      id,
      company: '',
      contact: '',
      city: 'Gent',
      sector: 'Horeca',
      hue: Math.floor(Math.random() * 360),
      onboardingDone: false,
      favorites: [],
      workplace: workplaceFromCity('Gent'),
    }
    commit((p) => ({
      ...p,
      employers: [...p.employers, employer],
      session: { role: 'employer', seekerId: p.session?.seekerId ?? 's-emma', employerId: id },
    }))
  }, [commit])

  const updateSeeker = useCallback(
    (id: string, patch: Partial<Seeker>) => {
      commit((p) => ({
        ...p,
        seekers: p.seekers.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      }))
    },
    [commit],
  )

  const updateEmployer = useCallback(
    (id: string, patch: Partial<Employer>) => {
      commit((p) => ({
        ...p,
        employers: p.employers.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      }))
    },
    [commit],
  )

  const toggleFavorite = useCallback(
    (employerId: string, seekerId: string) => {
      commit((p) => ({
        ...p,
        employers: p.employers.map((e) => {
          if (e.id !== employerId) return e
          const has = e.favorites.includes(seekerId)
          return {
            ...e,
            favorites: has ? e.favorites.filter((id) => id !== seekerId) : [...e.favorites, seekerId],
          }
        }),
      }))
    },
    [commit],
  )

  const setRecurring = useCallback(
    (id: string, day: Weekday, slots: Slot[]) => {
      commit((p) => ({
        ...p,
        seekers: p.seekers.map((s) =>
          s.id === id ? { ...s, recurring: { ...s.recurring, [day]: slots } } : s,
        ),
      }))
    },
    [commit],
  )

  const setDayOverride = useCallback(
    (id: string, date: string, slots: Slot[] | null) => {
      commit((p) => ({
        ...p,
        seekers: p.seekers.map((s) => {
          if (s.id !== id) return s
          const overrides = { ...s.overrides }
          if (slots === null) delete overrides[date]
          else overrides[date] = slots
          return { ...s, overrides }
        }),
      }))
    },
    [commit],
  )

  const setDayHours = useCallback(
    (id: string, date: string, hours: DayHours | null) => {
      commit((p) => ({
        ...p,
        seekers: p.seekers.map((s) => {
          if (s.id !== id) return s
          const next = { ...(s.hours ?? {}) }
          if (hours === null) delete next[date]
          else next[date] = hours
          return { ...s, hours: next }
        }),
      }))
    },
    [commit],
  )

  const applyRecurringHours = useCallback(
    (id: string, dates: string[]) => {
      commit((p) => ({
        ...p,
        seekers: p.seekers.map((s) => {
          if (s.id !== id) return s
          const next = { ...(s.hours ?? {}) }
          for (const date of dates) {
            const dh = dayHoursFromSlots(s.recurring[weekdayFromIso(date)] ?? [])
            if (dh.flexible || dh.ranges.length > 0) next[date] = dh
            else delete next[date]
          }
          return { ...s, hours: next }
        }),
      }))
    },
    [commit],
  )

  const addJob = useCallback(
    (job: Omit<Job, 'id' | 'status'>) => {
      const id = uid('j')
      commit((p) => ({
        ...p,
        jobs: [{ ...job, id, status: 'open' }, ...p.jobs],
      }))
      return id
    },
    [commit],
  )

  const addRequest = useCallback(
    (req: Omit<WorkRequest, 'id' | 'createdAt' | 'status'>) => {
      commit((p) => ({
        ...p,
        requests: [
          {
            ...req,
            id: uid('r'),
            createdAt: new Date().toISOString(),
            status: 'pending',
          },
          ...p.requests,
        ],
      }))
    },
    [commit],
  )

  const setRequestStatus = useCallback(
    (id: string, status: WorkRequest['status']) => {
      commit((p) => {
        const nextReqs = p.requests.map((r) => {
          if (r.id !== id) return r
          return {
            ...r,
            status,
            readAt: status === 'accepted' ? undefined : r.readAt,
          }
        })
        const req = nextReqs.find((r) => r.id === id)
        const prev = p.requests.find((r) => r.id === id)
        const jobs = p.jobs.map((j) => {
          if (!req?.jobId || j.id !== req.jobId) return j
          const filled = nextReqs.filter((r) => r.jobId === j.id && r.status === 'accepted').length
          return { ...j, status: filled >= j.peopleNeeded ? ('filled' as const) : ('open' as const) }
        })
        const seekers = p.seekers.map((s) => {
          if (!req || s.id !== req.seekerId) return s
          if (status === 'accepted' && prev?.status !== 'accepted') {
            return { ...s, jobsDone: s.jobsDone + 1 }
          }
          if (status !== 'accepted' && prev?.status === 'accepted') {
            return { ...s, jobsDone: Math.max(0, s.jobsDone - 1) }
          }
          return s
        })
        return { ...p, requests: nextReqs, jobs, seekers }
      })
    },
    [commit],
  )

  const markRequestsRead = useCallback(
    (role: Role, id: string) => {
      commit((p) => ({
        ...p,
        requests: p.requests.map((r) => {
          const mine = role === 'seeker' ? r.seekerId === id : r.employerId === id
          if (!mine || r.readAt) return r
          return { ...r, readAt: new Date().toISOString() }
        }),
      }))
    },
    [commit],
  )

  const resetDemo = useCallback(() => {
    localStorage.removeItem(KEY)
    setState(load())
  }, [])

  const value = useMemo<Store>(
    () => ({
      ...state,
      login,
      logout,
      startNewSeeker,
      startNewEmployer,
      updateSeeker,
      updateEmployer,
      toggleFavorite,
      setRecurring,
      setDayOverride,
      setDayHours,
      applyRecurringHours,
      addJob,
      addRequest,
      setRequestStatus,
      markRequestsRead,
      resetDemo,
    }),
    [
      state,
      login,
      logout,
      startNewSeeker,
      startNewEmployer,
      updateSeeker,
      updateEmployer,
      toggleFavorite,
      setRecurring,
      setDayOverride,
      setDayHours,
      applyRecurringHours,
      addJob,
      addRequest,
      setRequestStatus,
      markRequestsRead,
      resetDemo,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('Store missing')
  return ctx
}
