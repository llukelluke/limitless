import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Emblem, Wordmark } from '../../components/Logo.jsx'
import './Splash.css'

const ADVANCE_AFTER_MS = 1800

// 01 Launch (emblem only) → 02 Brand Reveal (emblem + wordmark) → 03 Login.
// Auto-advances; clicking or pressing a key skips ahead.
export default function Splash({ reveal = false }) {
  const navigate = useNavigate()
  const next = reveal ? '/login' : '/welcome'

  useEffect(() => {
    const timer = setTimeout(() => navigate(next, { replace: true }), ADVANCE_AFTER_MS)
    return () => clearTimeout(timer)
  }, [navigate, next])

  return (
    <button
      type="button"
      className={`splash ${reveal ? 'splash--reveal' : ''}`}
      onClick={() => navigate(next, { replace: true })}
      aria-label="Continue to Limitless"
      title="Continue to Limitless"
    >
      <Emblem className="splash__emblem" />
      {reveal && <Wordmark className="splash__wordmark" />}
    </button>
  )
}
