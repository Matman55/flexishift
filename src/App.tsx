import { StoreProvider, useStore } from './store'
import { Landing } from './Landing'
import { SeekerApp } from './SeekerApp'
import { EmployerApp } from './EmployerApp'
import { CelebrateProvider } from './Celebrate'
import { PasswordRecovery, Splash } from './Auth'

function Gate() {
  const store = useStore()
  if (!store.ready) return <Splash />
  if (store.needsPassword) return <PasswordRecovery />
  if (store.session?.role === 'seeker') return <SeekerApp />
  if (store.session?.role === 'employer') return <EmployerApp />
  return (
    <Landing
      onDemoSeeker={() => store.login('seeker', 's-emma')}
      onDemoEmployer={() => store.login('employer', 'e-kroon')}
      onReset={() => store.resetDemo()}
    />
  )
}

export default function App() {
  return (
    <StoreProvider>
      <CelebrateProvider>
        <Gate />
      </CelebrateProvider>
    </StoreProvider>
  )
}
