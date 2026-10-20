import { Outlet, useLocation } from 'react-router-dom'
import HelpButton from '../components/HelpButton.jsx'
import { Emblem, Wordmark } from '../components/Logo.jsx'
import './AuthLayout.css'

// Screens 03–09: brand panel on the left, form panel on the right.
export default function AuthLayout() {
  const { state } = useLocation()

  return (
    <div className={`auth ${state?.fromSplash ? 'auth--fade-in' : ''}`}>
      <aside className="auth__brand">
        <div className="auth__emblem-container">
          <Emblem className="auth__emblem" />
          <Wordmark cropped className="auth__wordmark" />
          <div className="auth__brand-spacer" />
        </div>
      </aside>
      <main className="auth__panel">
        <HelpButton className="auth__help" />
        <Outlet />
      </main>
    </div>
  )
}
