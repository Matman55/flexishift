import { useState } from 'react'
import { Field, GhostButton, PrimaryButton, cardClass, inputClass } from './components'
import { Logo } from './Mascot'
import { isCloudEnabled } from './cloud'
import { useStore } from './store'
import type { Role } from './types'

type Mode = 'login' | 'signup' | 'forgot'

export function AuthModal({
  open,
  mode,
  role,
  onClose,
  onMode,
  onRole,
}: {
  open: boolean
  mode: Mode
  role: Role
  onClose: () => void
  onMode: (m: Mode) => void
  onRole: (r: Role) => void
}) {
  const store = useStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const submit = async () => {
    setError(null)
    if (!email.includes('@')) {
      setError('Vul een geldig e-mailadres in.')
      return
    }
    if (mode !== 'forgot' && password.length < 6) {
      setError('Kies een wachtwoord van minstens 6 tekens.')
      return
    }
    setBusy(true)
    const result =
      mode === 'login'
        ? await store.signIn(email, password)
        : mode === 'signup'
          ? await store.signUp(role, email, password)
          : await store.requestPasswordReset(email)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    if (mode === 'forgot' || result.needsConfirm) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-t-3xl border border-line bg-cream p-6 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold tracking-tight">
          {mode === 'login' ? 'Inloggen' : mode === 'signup' ? 'Account aanmaken' : 'Wachtwoord vergeten'}
        </h2>
        {!isCloudEnabled() && (
          <p className="mt-2 text-sm text-muted">
            Echte accounts staan klaar in de code, maar Supabase is nog niet ingesteld. Zie README.
          </p>
        )}
        {mode === 'signup' && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <ChipBtn active={role === 'seeker'} onClick={() => onRole('seeker')}>
              Werknemer
            </ChipBtn>
            <ChipBtn active={role === 'employer'} onClick={() => onRole('employer')}>
              Werkgever
            </ChipBtn>
          </div>
        )}
        <div className="mt-4 space-y-3">
          <Field label="E-mail">
            <input
              type="email"
              className={inputClass}
              value={email}
              autoComplete="email"
              placeholder="jij@voorbeeld.be"
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          {mode !== 'forgot' && (
            <Field label="Wachtwoord">
              <input
                type="password"
                className={inputClass}
                value={password}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                placeholder="Minstens 6 tekens"
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void submit()
                }}
              />
            </Field>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        {store.authNotice && mode !== 'login' && (
          <p className="mt-3 text-sm text-ink">{store.authNotice}</p>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <PrimaryButton onClick={() => void submit()} className="flex-1">
            {busy
              ? 'Even…'
              : mode === 'login'
                ? 'Inloggen'
                : mode === 'signup'
                  ? 'Account maken'
                  : 'Stuur reset-link'}
          </PrimaryButton>
          <GhostButton onClick={onClose}>Sluiten</GhostButton>
        </div>
        <div className="mt-4 space-y-1 text-sm">
          {mode !== 'login' && (
            <button type="button" className="text-muted underline hover:text-ink" onClick={() => onMode('login')}>
              Ik heb al een account
            </button>
          )}
          {mode === 'login' && (
            <>
              <button type="button" className="block text-muted underline hover:text-ink" onClick={() => onMode('signup')}>
                Nog geen account? Maak er een
              </button>
              <button type="button" className="block text-muted underline hover:text-ink" onClick={() => onMode('forgot')}>
                Wachtwoord vergeten
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ChipBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-sm font-semibold ${
        active ? 'bg-ink text-cream' : 'border border-line bg-cream text-ink hover:bg-zinc-50'
      }`}
    >
      {children}
    </button>
  )
}

export function PasswordRecovery() {
  const store = useStore()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className={`${cardClass} w-full max-w-md p-6`}>
        <Logo compact />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Nieuw wachtwoord</h1>
        <p className="mt-2 text-sm text-muted">Kies een wachtwoord van minstens 6 tekens.</p>
        <div className="mt-4">
          <Field label="Nieuw wachtwoord">
            <input
              type="password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
        </div>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        <PrimaryButton
          className="mt-5 w-full"
          onClick={() => {
            setBusy(true)
            void store.updatePassword(password).then((r) => {
              setBusy(false)
              if (!r.ok) setError(r.error)
            })
          }}
        >
          {busy ? 'Bewaren…' : 'Wachtwoord bewaren'}
        </PrimaryButton>
      </div>
    </div>
  )
}

export function DeleteAccountPanel() {
  const store = useStore()
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const real = Boolean(store.session?.userId)

  const remove = async () => {
    setError(null)
    setBusy(true)
    const result = await store.deleteAccount()
    setBusy(false)
    if (!result.ok) setError(result.error)
  }

  return (
    <div className={`${cardClass} space-y-3 p-6`}>
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Account verwijderen</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {real
            ? 'Dit wist je profiel, jobs, aanvragen en berichten. Daarna kun je niet meer inloggen met dit e-mailadres tot je opnieuw een account maakt.'
            : 'Dit is de demo (Emma of De Kroon). Die kun je niet verwijderen. Maak een eigen account aan als je die later wilt kunnen wissen.'}
        </p>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {!real ? null : !confirm ? (
        <GhostButton onClick={() => setConfirm(true)} className="!border-red-200 !text-red-800 hover:!bg-red-50">
          Account verwijderen
        </GhostButton>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void remove()}
            className="inline-flex items-center justify-center rounded-lg bg-red-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-800 disabled:opacity-60"
          >
            {busy ? 'Bezig…' : 'Ja, definitief verwijderen'}
          </button>
          <GhostButton
            onClick={() => {
              setConfirm(false)
              setError(null)
            }}
          >
            Annuleren
          </GhostButton>
        </div>
      )}
    </div>
  )
}

export function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6">
      <Logo compact />
      <p className="text-sm text-muted">Even laden…</p>
    </div>
  )
}
