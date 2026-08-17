import { StoreProvider, useStore } from './store'
import { Landing } from './Landing'
import { SeekerApp } from './SeekerApp'
import { EmployerApp } from './EmployerApp'
import { GuideProvider } from './Mascot'

function Gate() {
  const store = useStore()
  if (store.session?.role === 'seeker') return <SeekerApp />
  if (store.session?.role === 'employer') return <EmployerApp />
  return (
    <Landing
      onDemoSeeker={() => store.login('seeker', 's-emma')}
      onDemoEmployer={() => store.login('employer', 'e-kroon')}
      onNewSeeker={() => store.startNewSeeker()}
      onNewEmployer={() => store.startNewEmployer()}
      onReset={() => store.resetDemo()}
    />
  )
}

export default function App() {
  return (
    <StoreProvider>
      <GuideProvider>
        <Gate />
      </GuideProvider>
    </StoreProvider>
  )
}
