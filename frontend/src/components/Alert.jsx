import { useEffect, useRef } from 'react'
import useFocusFirstError from '../hooks/useFocusFirstError.js'
import './Alert.css'

// Inline status message. `tone`: error | success | info. `surface`: dark (auth screens) | light (cream panels).
export default function Alert({ tone = 'error', surface = 'light', children }) {
  const ref = useRef(null)
  const error = tone === 'error'

  // Errors jump to the first invalid field (or this message). Only plain-text messages trigger it: JSX
  // children are new on every render and would steal focus while the user types.
  useFocusFirstError(error && typeof children === 'string' ? children : null)

  // Bring other new messages into view; on long forms they would otherwise appear below the fold
  useEffect(() => {
    if (!error) ref.current?.scrollIntoView?.({ block: 'nearest' })
  }, [children, error])

  if (!children) return null
  return (
    <div ref={ref} className={`alert alert--${tone} alert--${surface}`} role={error ? 'alert' : 'status'}>
      {children}
    </div>
  )
}
