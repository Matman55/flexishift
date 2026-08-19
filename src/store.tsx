import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { defaultContract, emptyRecurring, uid, ensureWorkplace, workplaceFromCity, isoDate } from './constants'
import { EMPLOYERS, SEEKERS, mergeDemoWorkedRequests, seedDemoRequests, seedJobs, weekdayFromIso } from './data'
import { dayHoursFromSlots, rangeFromSlots } from './time'
import type {
  AppState,
  ChatMessage,
  DayHours,
  Employer,
  Job,
  MailKind,
  MailLogItem,
  Role,
  Seeker,
  Slot,
  Weekday,
  WorkRequest,
  SavedSearch,
} from './types'
import { bookedBySeekerOnDate, rankSeekers } from './match'
import { buildMail, buildJobPostMail, counterpart, defaultMailPrefs, deliverMail, withMailDefaults } from './notify'
import {
  appUrl,
  authErrorMessage,
  deleteOwnAccount,
  fetchMarket,
  getSupabase,
  isCloudEnabled,
  sessionFromUser,
  subscribeMarket,
  syncCloud,
} from './cloud'

const KEY = 'flexishift-v2'

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppState
      if (parsed.seekers?.length && parsed.jobs?.length) {
        const seededById = Object.fromEntries(seedJobs().map((j) => [j.id, j]))
        const requests = mergeDemoWorkedRequests(parsed.requests ?? [])
        const next: AppState = {
          ...parsed,
          seekers: parsed.seekers.map((s) => withMailDefaults({ ...s, hours: s.hours ?? {} }, s.name || 'flexi')),
          employers: (parsed.employers?.length ? parsed.employers : EMPLOYERS).map((e) =>
            withMailDefaults(
              {
                ...e,
                onboardingDone: e.onboardingDone !== false,
                favorites: e.favorites ?? [],
                savedSearches: e.savedSearches ?? [],
                workplace: e.workplace ?? workplaceFromCity(e.city),
              },
              e.contact || e.company,
            ),
          ),
          jobs: parsed.jobs.map((j) => {
            let job = j
            if (!j.startTime || !j.endTime) {
              const t = rangeFromSlots(j.slots ?? ['avond'])
              job = { ...job, startTime: t.start, endTime: t.end }
            }
            if (!job.workplace?.lat || !job.workplace?.lng) {
              job = {
                ...job,
                workplace: seededById[j.id]?.workplace ?? workplaceFromCity(j.city),
              }
            } else {
              job = { ...job, workplace: ensureWorkplace(job) }
            }
            const seeded = seededById[j.id]
            return {
              ...job,
              contractKind: job.contractKind ?? seeded?.contractKind ?? defaultContract(job.sector),
              requiresLicense: job.requiresLicense ?? job.skills?.includes('Chauffeur') ?? false,
            }
          }),
          requests,
          messages: (parsed.messages ?? []).map((m) => ({
            ...m,
            readBySeeker: m.readBySeeker ?? m.from === 'seeker',
            readByEmployer: m.readByEmployer ?? m.from === 'employer',
          })),
          mailLog: parsed.mailLog ?? [],
        }
        const prevSig = (parsed.requests ?? []).map((r) => `${r.id}:${r.hourlyRate ?? ''}`).join('|')
        const nextSig = requests.map((r) => `${r.id}:${r.hourlyRate ?? ''}`).join('|')
        if (prevSig !== nextSig) persist(next)
        return next
      }
    }
  } catch {
    /* ignore */
  }
  const jobs = seedJobs()
  return {
    session: null,
    seekers: SEEKERS.map((s) => withMailDefaults(s, s.name)),
    employers: EMPLOYERS.map((e) => withMailDefaults(e, e.contact || e.company)),
    jobs,
    requests: seedDemoRequests(jobs[0]),
    messages: [],
    mailLog: [],
  }
}

function persist(state: AppState) {
  localStorage.setItem(KEY, JSON.stringify(state))
}

function logMail(p: AppState, item: MailLogItem | null): AppState {
  if (!item) return p
  void deliverMail(item)
  return { ...p, mailLog: [item, ...(p.mailLog ?? [])].slice(0, 40) }
}

function notifyRequest(p: AppState, kind: MailKind, request: WorkRequest, toRole: Role, extra?: string): AppState {
  return logMail(p, buildMail(p, kind, toRole, request, extra))
}

type AuthResult = { ok: true; needsConfirm?: boolean } | { ok: false; error: string }

type Store = AppState & {
  ready: boolean
  cloud: boolean
  needsPassword: boolean
  authNotice: string | null
  login: (role: Role, id?: string) => void
  logout: () => void
  signUp: (role: Role, email: string, password: string) => Promise<AuthResult>
  signIn: (email: string, password: string) => Promise<AuthResult>
  requestPasswordReset: (email: string) => Promise<AuthResult>
  updatePassword: (password: string) => Promise<AuthResult>
  deleteAccount: () => Promise<AuthResult>
  clearAuthNotice: () => void
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
  updateJob: (id: string, patch: Partial<Job>) => void
  addRequest: (req: Omit<WorkRequest, 'id' | 'createdAt' | 'status'>) => void
  setRequestStatus: (id: string, status: WorkRequest['status']) => void
  patchRequest: (id: string, patch: Partial<WorkRequest>) => void
  cancelRequest: (id: string, by: Role, reason: string) => void
  saveSearch: (employerId: string, search: Omit<SavedSearch, 'id'>) => void
  removeSearch: (employerId: string, searchId: string) => void
  markRequestsRead: (role: Role, id: string) => void
  addMessage: (requestId: string, from: Role, text: string) => void
  sendChat: (opts: {
    seekerId: string
    employerId: string
    jobId?: string | null
    from: Role
    text: string
  }) => void
  markChatRead: (requestId: string, role: Role) => void
  resetDemo: () => void
}

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(load)
  const [ready, setReady] = useState(!isCloudEnabled())
  const [needsPassword, setNeedsPassword] = useState(false)
  const [authNotice, setAuthNotice] = useState<string | null>(null)
  const skipRealtime = useRef(false)

  const commit = useCallback((updater: (prev: AppState) => AppState) => {
    setState((prev) => {
      const next = updater(prev)
      if (!next.session?.userId) persist(next)
      else if (next !== prev) {
        skipRealtime.current = true
        void syncCloud(prev, next).finally(() => {
          window.setTimeout(() => {
            skipRealtime.current = false
          }, 800)
        })
      }
      return next
    })
  }, [])

  useEffect(() => {
    if (!isCloudEnabled()) return
    const sb = getSupabase()
    let stopMarket = () => {}
    let alive = true

    const boot = async () => {
      try {
        const { data } = await sb.auth.getSession()
        const market = await fetchMarket()
        if (!alive) return
        const sess = data.session?.user ? await sessionFromUser(data.session.user, market) : null
        setState({ ...market, session: sess, mailLog: [] })
      } catch (e) {
        console.warn(e)
        setAuthNotice('Kon de cloud niet laden. Check je Supabase-instellingen.')
      } finally {
        if (alive) setReady(true)
      }
    }

    void boot()

    const { data: authSub } = sb.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') setNeedsPassword(true)
      if (event === 'SIGNED_OUT') {
        setNeedsPassword(false)
        setState((s) => ({ ...s, session: null }))
      }
      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.user) {
        try {
          const market = await fetchMarket()
          const sess = await sessionFromUser(session.user, market)
          setState({ ...market, session: sess, mailLog: [] })
          if (event === 'SIGNED_IN') setNeedsPassword(false)
        } catch {
          /* keep current */
        }
      }
    })

    const reload = () => {
      if (skipRealtime.current) return
      void fetchMarket()
        .then((market) => {
          setState((s) => ({ ...s, ...market, session: s.session, mailLog: s.mailLog }))
        })
        .catch(() => {})
    }
    stopMarket = subscribeMarket(reload)

    return () => {
      alive = false
      authSub.subscription.unsubscribe()
      stopMarket()
    }
  }, [])

  const login = useCallback(
    (role: Role, id?: string) => {
      commit(() => {
        const base = load()
        return {
          ...base,
          session: {
            role,
            seekerId: role === 'seeker' ? (id ?? 's-emma') : 's-emma',
            employerId: role === 'employer' ? (id ?? 'e-kroon') : 'e-kroon',
          },
        }
      })
    },
    [commit],
  )

  const logout = useCallback(() => {
    if (isCloudEnabled() && state.session?.userId) {
      void getSupabase().auth.signOut()
    }
    commit((p) => ({ ...p, session: null }))
  }, [commit, state.session?.userId])

  const applyCloudSession = useCallback(async (user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }) => {
    let last = await fetchMarket()
    let sess = await sessionFromUser(user, last)
    for (let i = 0; i < 10 && !sess; i++) {
      await new Promise((r) => setTimeout(r, 300))
      last = await fetchMarket()
      sess = await sessionFromUser(user, last)
    }
    if (!sess) return false
    setState({ ...last, session: sess, mailLog: [] })
    return true
  }, [])

  const signUp = useCallback(
    async (role: Role, email: string, password: string): Promise<AuthResult> => {
      if (!isCloudEnabled()) {
        return { ok: false, error: 'Accounts zijn nog niet geconfigureerd. Zet Supabase in .env (zie README).' }
      }
      const sb = getSupabase()
      const { data, error } = await sb.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { role }, emailRedirectTo: appUrl() },
      })
      if (error) return { ok: false, error: authErrorMessage(error) }
      if (!data.user) return { ok: false, error: 'Account aanmaken mislukt.' }
      if (!data.session) {
        setAuthNotice('Check je inbox: bevestig je e-mail via de link. Daarna kun je inloggen.')
        return { ok: true, needsConfirm: true }
      }
      const ok = await applyCloudSession(data.user)
      if (!ok) return { ok: false, error: 'Account is aangemaakt, maar het profiel verscheen niet. Vernieuw de pagina.' }
      return { ok: true }
    },
    [applyCloudSession],
  )

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      if (!isCloudEnabled()) {
        return { ok: false, error: 'Accounts zijn nog niet geconfigureerd. Zet Supabase in .env (zie README).' }
      }
      const sb = getSupabase()
      const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password })
      if (error) return { ok: false, error: authErrorMessage(error) }
      if (!data.user) return { ok: false, error: 'Inloggen mislukt.' }
      const ok = await applyCloudSession(data.user)
      if (!ok) return { ok: false, error: 'Ingelogd, maar geen profiel gevonden. Vernieuw de pagina.' }
      return { ok: true }
    },
    [applyCloudSession],
  )

  const requestPasswordReset = useCallback(async (email: string): Promise<AuthResult> => {
    if (!isCloudEnabled()) return { ok: false, error: 'Cloud is niet geconfigureerd.' }
    const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl() })
    if (error) return { ok: false, error: authErrorMessage(error) }
    setAuthNotice('Als dit adres bestaat, sturen we een reset-link. Check je inbox.')
    return { ok: true }
  }, [])

  const updatePassword = useCallback(async (password: string): Promise<AuthResult> => {
    if (!isCloudEnabled()) return { ok: false, error: 'Cloud is niet geconfigureerd.' }
    const { error } = await getSupabase().auth.updateUser({ password })
    if (error) return { ok: false, error: authErrorMessage(error) }
    setNeedsPassword(false)
    setAuthNotice('Nieuw wachtwoord bewaard. Je bent ingelogd.')
    return { ok: true }
  }, [])

  const deleteAccount = useCallback(async (): Promise<AuthResult> => {
    if (!state.session?.userId) {
      return {
        ok: false,
        error: 'Dit is de demo. Emma en De Kroon kun je niet verwijderen. Maak een eigen account aan.',
      }
    }
    if (!isCloudEnabled()) {
      commit((p) => ({ ...p, session: null }))
      return { ok: true }
    }
    const result = await deleteOwnAccount()
    if (!result.ok) return result
    commit((p) => ({ ...p, session: null }))
    return { ok: true }
  }, [commit, state.session?.userId])

  const clearAuthNotice = useCallback(() => setAuthNotice(null), [])

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
      jobsDone: 0,
      recurring: emptyRecurring(),
      hours: {},
      overrides: {},
      blocked: [],
      onboardingDone: false,
      email: '',
      mailPrefs: defaultMailPrefs(),
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
      savedSearches: [],
      workplace: workplaceFromCity('Gent'),
      email: '',
      mailPrefs: defaultMailPrefs(),
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
      commit((p) => {
        const created: Job = {
          ...job,
          id,
          status: 'open',
          postedAt: job.postedAt ?? new Date().toISOString(),
        }
        let next: AppState = { ...p, jobs: [created, ...p.jobs] }
        const matches = rankSeekers(
          p.seekers.filter((s) => s.onboardingDone),
          {
            date: created.date,
            slots: created.slots,
            startTime: created.startTime,
            endTime: created.endTime,
            skills: created.skills,
            city: created.city,
            urgent: created.urgent,
            workplace: created.workplace,
            hourlyRate: created.hourlyRate,
            requiresLicense: created.requiresLicense,
            bookedBySeeker: bookedBySeekerOnDate(p.requests, created.date),
          },
        )
        for (const m of matches) {
          next = logMail(next, buildJobPostMail(created, m.seeker))
        }
        return next
      })
      return id
    },
    [commit],
  )

  const updateJob = useCallback(
    (id: string, patch: Partial<Job>) => {
      commit((p) => ({
        ...p,
        jobs: p.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)),
        requests: p.requests.map((r) => {
          if (r.jobId !== id || (r.status !== 'pending' && r.status !== 'accepted')) return r
          return {
            ...r,
            date: patch.date ?? r.date,
            startTime: patch.startTime ?? r.startTime,
            endTime: patch.endTime ?? r.endTime,
            title: patch.title ?? r.title,
            city: patch.city ?? r.city,
            hourlyRate: patch.hourlyRate ?? r.hourlyRate,
            slots: patch.slots ?? r.slots,
          }
        }),
      }))
    },
    [commit],
  )

  const addRequest = useCallback(
    (req: Omit<WorkRequest, 'id' | 'createdAt' | 'status'>) => {
      commit((p) => {
        const created: WorkRequest = {
          ...req,
          hourlyRate:
            req.hourlyRate ??
            (req.jobId ? p.jobs.find((j) => j.id === req.jobId)?.hourlyRate : undefined),
          id: uid('r'),
          createdAt: new Date().toISOString(),
          status: 'pending',
        }
        const next: AppState = { ...p, requests: [created, ...p.requests] }
        const kind = req.from === 'employer' ? 'ask' : 'apply'
        return notifyRequest(next, kind, created, counterpart(req.from))
      })
    },
    [commit],
  )

  const setRequestStatus = useCallback(
    (id: string, status: WorkRequest['status']) => {
      commit((p) => {
        const nextReqs = p.requests.map((r) => {
          if (r.id !== id) return r
          const jobRate = r.jobId ? p.jobs.find((j) => j.id === r.jobId)?.hourlyRate : undefined
          return {
            ...r,
            status,
            hourlyRate: r.hourlyRate ?? (status === 'accepted' ? jobRate : r.hourlyRate),
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
        let next: AppState = { ...p, requests: nextReqs, jobs, seekers }
        if (req && prev && prev.status !== status) {
          if (status === 'accepted') {
            next = notifyRequest(next, 'accepted', req, 'seeker')
            next = notifyRequest(next, 'accepted', req, 'employer')
          } else if (status === 'declined') {
            next = notifyRequest(next, status, req, req.from)
          }
        }
        return next
      })
    },
    [commit],
  )

  const patchRequest = useCallback(
    (id: string, patch: Partial<WorkRequest>) => {
      commit((p) => ({
        ...p,
        requests: p.requests.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      }))
    },
    [commit],
  )

  const cancelRequest = useCallback(
    (id: string, by: Role, reason: string) => {
      commit((p) => {
        const prev = p.requests.find((r) => r.id === id)
        const nextReqs = p.requests.map((r) =>
          r.id === id
            ? {
                ...r,
                status: 'cancelled' as const,
                cancelledAt: new Date().toISOString(),
                cancelledBy: by,
                cancelReason: reason.trim() || 'Geen reden opgegeven',
                readAt: undefined,
              }
            : r,
        )
        const req = nextReqs.find((r) => r.id === id)
        const jobs = p.jobs.map((j) => {
          if (!req?.jobId || j.id !== req.jobId) return j
          const filled = nextReqs.filter((r) => r.jobId === j.id && r.status === 'accepted').length
          return { ...j, status: filled >= j.peopleNeeded ? ('filled' as const) : ('open' as const) }
        })
        const seekers = p.seekers.map((s) => {
          if (!req || s.id !== req.seekerId) return s
          if (prev?.status === 'accepted') return { ...s, jobsDone: Math.max(0, s.jobsDone - 1) }
          return s
        })
        let next: AppState = { ...p, requests: nextReqs, jobs, seekers }
        if (req && prev && prev.status !== 'cancelled') {
          next = notifyRequest(next, 'cancelled', req, counterpart(by))
        }
        return next
      })
    },
    [commit],
  )

  const saveSearch = useCallback(
    (employerId: string, search: Omit<SavedSearch, 'id'>) => {
      commit((p) => ({
        ...p,
        employers: p.employers.map((e) =>
          e.id === employerId
            ? { ...e, savedSearches: [{ ...search, id: uid('q') }, ...(e.savedSearches ?? [])].slice(0, 6) }
            : e,
        ),
      }))
    },
    [commit],
  )

  const removeSearch = useCallback(
    (employerId: string, searchId: string) => {
      commit((p) => ({
        ...p,
        employers: p.employers.map((e) =>
          e.id === employerId
            ? { ...e, savedSearches: (e.savedSearches ?? []).filter((s) => s.id !== searchId) }
            : e,
        ),
      }))
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

  const addMessage = useCallback(
    (requestId: string, from: Role, text: string) => {
      const body = text.trim()
      if (!body) return
      const msg: ChatMessage = {
        id: uid('m'),
        requestId,
        from,
        text: body,
        createdAt: new Date().toISOString(),
        readBySeeker: from === 'seeker',
        readByEmployer: from === 'employer',
      }
      commit((p) => {
        const req = p.requests.find((r) => r.id === requestId)
        if (!req) return p
        if (p.messages.some((m) => m.id === msg.id)) return p
        const last = [...p.messages].reverse().find((m) => m.requestId === requestId)
        if (
          last &&
          last.from === from &&
          last.text === body &&
          Date.now() - Date.parse(last.createdAt) < 4000
        ) {
          return p
        }
        const next: AppState = { ...p, messages: [...p.messages, msg] }
        return notifyRequest(next, 'message', req, counterpart(from), body)
      })
    },
    [commit],
  )

  const sendChat = useCallback(
    (opts: {
      seekerId: string
      employerId: string
      jobId?: string | null
      from: Role
      text: string
    }) => {
      const body = opts.text.trim()
      if (!body) return
      const msgId = uid('m')
      const newReqId = uid('r')
      const createdAt = new Date().toISOString()
      commit((p) => {
        if (p.messages.some((m) => m.id === msgId)) return p
        let req = p.requests.find((r) => r.seekerId === opts.seekerId && r.employerId === opts.employerId)
        let requests = p.requests
        if (req) {
          const last = [...p.messages].reverse().find((m) => m.requestId === req!.id)
          if (
            last &&
            last.from === opts.from &&
            last.text === body &&
            Date.now() - Date.parse(last.createdAt) < 4000
          ) {
            return p
          }
        }
        if (!req) {
          const employer = p.employers.find((e) => e.id === opts.employerId)
          const seeker = p.seekers.find((s) => s.id === opts.seekerId)
          const job = opts.jobId ? p.jobs.find((j) => j.id === opts.jobId) : undefined
          req = {
            id: newReqId,
            kind: 'chat',
            jobId: job?.id ?? null,
            employerId: opts.employerId,
            seekerId: opts.seekerId,
            from: opts.from,
            message: '',
            status: 'pending',
            createdAt: new Date().toISOString(),
            date: job?.date ?? isoDate(0),
            slots: job?.slots ?? [],
            startTime: job?.startTime,
            endTime: job?.endTime,
            title: job ? `Vraag over “${job.title}”` : 'Bericht',
            city: job?.city ?? employer?.city ?? seeker?.city ?? 'Gent',
          }
          requests = [req, ...p.requests]
        }
        const msg: ChatMessage = {
          id: msgId,
          requestId: req.id,
          from: opts.from,
          text: body,
          createdAt,
          readBySeeker: opts.from === 'seeker',
          readByEmployer: opts.from === 'employer',
        }
        const next: AppState = { ...p, requests, messages: [...p.messages, msg] }
        return notifyRequest(next, 'message', req, counterpart(opts.from), body)
      })
    },
    [commit],
  )

  const markChatRead = useCallback(
    (requestId: string, role: Role) => {
      commit((p) => {
        let changed = false
        const messages = p.messages.map((m) => {
          if (m.requestId !== requestId || m.from === role) return m
          if (role === 'seeker' && m.readBySeeker) return m
          if (role === 'employer' && m.readByEmployer) return m
          changed = true
          return {
            ...m,
            readBySeeker: role === 'seeker' ? true : m.readBySeeker,
            readByEmployer: role === 'employer' ? true : m.readByEmployer,
          }
        })
        return changed ? { ...p, messages } : p
      })
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
      ready,
      cloud: isCloudEnabled(),
      needsPassword,
      authNotice,
      login,
      logout,
      signUp,
      signIn,
      requestPasswordReset,
      updatePassword,
      deleteAccount,
      clearAuthNotice,
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
      updateJob,
      addRequest,
      setRequestStatus,
      patchRequest,
      cancelRequest,
      saveSearch,
      removeSearch,
      markRequestsRead,
      addMessage,
      sendChat,
      markChatRead,
      resetDemo,
    }),
    [
      state,
      ready,
      needsPassword,
      authNotice,
      login,
      logout,
      signUp,
      signIn,
      requestPasswordReset,
      updatePassword,
      deleteAccount,
      clearAuthNotice,
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
      updateJob,
      addRequest,
      setRequestStatus,
      patchRequest,
      cancelRequest,
      saveSearch,
      removeSearch,
      markRequestsRead,
      addMessage,
      sendChat,
      markChatRead,
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
