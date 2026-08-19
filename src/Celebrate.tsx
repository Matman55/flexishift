import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

const CelebrateContext = createContext<() => void>(() => {})

export function useCelebrate() {
  return useContext(CelebrateContext)
}

export function CelebrateProvider({ children }: { children: ReactNode }) {
  const [on, setOn] = useState(false)
  const celebrate = useCallback(() => setOn(true), [])
  return (
    <CelebrateContext.Provider value={celebrate}>
      {children}
      {on && <FlexiJump onDone={() => setOn(false)} />}
    </CelebrateContext.Provider>
  )
}

function FlexiJump({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 8000)
    return () => window.clearTimeout(t)
  }, [onDone])

  return (
    <div className="pointer-events-none fixed inset-0 z-[80] flex flex-col items-center justify-center">
      <video
        autoPlay
        muted
        playsInline
        src={`${import.meta.env.BASE_URL}flexi-jump.webm`}
        className="h-64 w-64 object-contain sm:h-80 sm:w-80"
        onEnded={onDone}
        onError={onDone}
      />
      <p className="mt-1 text-2xl font-extrabold tracking-tight text-ink">Bevestigd!</p>
    </div>
  )
}
