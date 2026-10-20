import { useEffect, useRef } from 'react'
import './Alert.css'

// Inline status message. `tone`: error | success | info. `surface`: dark (auth screens) | light (cream panels).
export default function Alert({ tone = 'error', surface = 'light', children }) {
  const ref = useRef(null)

  // Bring a new message into view; on long forms it would otherwise appear below the fold
  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: 'nearest' })
  }, [children])

  if (!children) return null
  return (
    <div ref={ref} className={`alert alert--${tone} alert--${surface}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}
