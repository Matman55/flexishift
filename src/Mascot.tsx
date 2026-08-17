import { useEffect, useState, type ReactNode } from 'react'

export type MascotPose = 'search' | 'wave' | 'point' | 'celebrate' | 'idle' | 'hint'

export function Mascot({
  pose = 'search',
  size = 120,
  bob = false,
  className = '',
}: {
  pose?: MascotPose
  size?: number
  bob?: boolean
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 220 250"
      width={size}
      height={size * (250 / 220)}
      className={`${bob ? 'mascot-bob' : ''} ${className}`}
      aria-hidden
    >
      <ellipse cx="110" cy="236" rx="48" ry="8" fill="rgba(17,17,17,0.12)" />
      <Arms pose={pose} />
      <ellipse cx="110" cy="128" rx="78" ry="80" fill="#F5C400" stroke="#111" strokeWidth="5" />
      <ellipse cx="110" cy="168" rx="48" ry="30" fill="#E09B00" opacity="0.28" />
      <ellipse cx="82" cy="202" rx="18" ry="15" fill="#F5C400" stroke="#111" strokeWidth="4" />
      <ellipse cx="138" cy="202" rx="18" ry="15" fill="#F5C400" stroke="#111" strokeWidth="4" />
      <Face pose={pose} />
      {pose === 'search' && <Glass />}
    </svg>
  )
}

function Arms({ pose }: { pose: MascotPose }) {
  if (pose === 'wave' || pose === 'celebrate') {
    return (
      <>
        <ellipse
          cx="38"
          cy={pose === 'celebrate' ? 70 : 62}
          rx="16"
          ry="22"
          fill="#F5C400"
          stroke="#111"
          strokeWidth="4"
          transform={pose === 'wave' ? 'rotate(-28 38 62)' : 'rotate(-18 38 70)'}
        />
        <ellipse
          cx="182"
          cy="68"
          rx="16"
          ry="22"
          fill="#F5C400"
          stroke="#111"
          strokeWidth="4"
          transform="rotate(22 182 68)"
        />
      </>
    )
  }
  if (pose === 'point' || pose === 'hint') {
    return (
      <>
        <ellipse cx="40" cy="150" rx="15" ry="20" fill="#F5C400" stroke="#111" strokeWidth="4" transform="rotate(18 40 150)" />
        <rect x="168" y="108" width="46" height="16" rx="8" fill="#F5C400" stroke="#111" strokeWidth="4" />
      </>
    )
  }
  return (
    <>
      <ellipse cx="40" cy="148" rx="15" ry="20" fill="#F5C400" stroke="#111" strokeWidth="4" transform="rotate(12 40 148)" />
      <ellipse cx="180" cy="148" rx="15" ry="20" fill="#F5C400" stroke="#111" strokeWidth="4" transform="rotate(-12 180 148)" />
    </>
  )
}

function Face({ pose }: { pose: MascotPose }) {
  const search = pose === 'search'
  return (
    <>
      <path d="M78 96 Q90 88 102 96" fill="none" stroke="#111" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="92" cy="118" r={search ? 12 : 13} fill="#111" />
      <circle cx="97" cy="113" r="4.2" fill="#fff" />
      {!search && (
        <>
          <circle cx="132" cy="118" r="13" fill="#111" />
          <circle cx="137" cy="113" r="4.2" fill="#fff" />
        </>
      )}
      <path
        d="M102 148 Q112 160 126 148"
        fill="none"
        stroke="#111"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </>
  )
}

function Glass() {
  return (
    <g>
      <circle cx="148" cy="116" r="34" fill="rgba(255,255,255,0.18)" stroke="#F5C400" strokeWidth="10" />
      <circle cx="148" cy="116" r="34" fill="none" stroke="#111" strokeWidth="4" />
      <circle cx="148" cy="116" r="18" fill="#111" />
      <circle cx="155" cy="108" r="6" fill="#fff" />
      <line x1="172" y1="140" x2="196" y2="172" stroke="#111" strokeWidth="9" strokeLinecap="round" />
    </g>
  )
}

export function Wordmark({ light = false, className = '' }: { light?: boolean; className?: string }) {
  return (
    <span className={`font-extrabold tracking-tight ${className}`}>
      <span className="text-terra">FLEXI</span>
      <span className={light ? 'text-white' : 'text-ink'}>SHIFT</span>
    </span>
  )
}

export function Logo({
  compact = false,
}: {
  compact?: boolean
  light?: boolean
}) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}logo.png`}
      alt="FlexiShift"
      className="w-auto object-contain object-left"
      style={{ height: compact ? 44 : 56 }}
    />
  )
}

type Tip = { pose: MascotPose; title?: string; text: string }

let setTipFn: ((tip: Tip | null) => void) | null = null

export function GuideProvider({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<Tip | null>(null)
  const [open, setOpen] = useState(true)
  setTipFn = setTip

  return (
    <>
      {children}
      {tip && (
        <div className="pointer-events-none fixed bottom-24 right-3 z-40 flex items-end gap-2 md:bottom-6 md:right-6">
          {open && (
            <div className="pointer-events-auto mb-3 max-w-[230px] rounded-2xl border border-line bg-white px-3.5 py-3 shadow-[0_12px_40px_rgba(17,17,17,0.14)]">
              <div className="text-[11px] font-bold uppercase tracking-wide text-terra">
                Flexi, je assistent
              </div>
              {tip.title && <div className="mt-0.5 text-sm font-bold">{tip.title}</div>}
              <p className="mt-1 text-sm leading-snug text-muted">{tip.text}</p>
            </div>
          )}
          <button
            type="button"
            className="pointer-events-auto shrink-0"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Tip sluiten' : 'Tip openen'}
          >
            <Mascot pose={tip.pose} size={92} bob />
          </button>
        </div>
      )}
    </>
  )
}

export function Guide({ pose, title, text }: Tip) {
  useEffect(() => {
    setTipFn?.({ pose, title, text })
    return () => setTipFn?.(null)
  }, [pose, title, text])
  return null
}

export function EmptyMascot({
  title,
  text,
  pose = 'search',
}: {
  title: string
  text: string
  pose?: MascotPose
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-zinc-50 px-6 py-10 text-center">
      <Mascot pose={pose} size={110} bob />
      <h3 className="mt-3 font-bold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>
    </div>
  )
}
