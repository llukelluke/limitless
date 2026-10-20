import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Emblem, Wordmark } from '../../components/Logo.jsx'
import './Splash.css'

const HOLD_MS = 2000
const FADE_MS = 600

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// 01–02 Launch / Brand Reveal: the logo shows for 2 seconds, then fades into 03 Login.
// Clicking or pressing a key skips ahead.
export default function Splash() {
  const navigate = useNavigate()
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const fade = prefersReducedMotion() ? 0 : FADE_MS
    const toLogin = () => navigate('/login', { replace: true, state: { fromSplash: true } })
    const start = setTimeout(() => setLeaving(true), HOLD_MS)
    const done = setTimeout(toLogin, HOLD_MS + fade)
    return () => {
      clearTimeout(start)
      clearTimeout(done)
    }
  }, [navigate])

  return (
    <button
      type="button"
      className={`splash ${leaving ? 'splash--leaving' : ''}`}
      onClick={() => navigate('/login', { replace: true })}
      aria-label="Continue to Limitless"
      title="Continue to Limitless"
    >
      <Emblem className="splash__emblem" />
      <Wordmark className="splash__wordmark" />
    </button>
  )
}
