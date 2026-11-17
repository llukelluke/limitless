import { useEffect, useRef } from 'react'
import useFocusFirstError from '../hooks/useFocusFirstError.js'
import './Alert.css'

// Inline status message. `tone`: error | success | info.
// `focus={false}` for status warnings shown on load (e.g. an out-of-balance statement): no jump to them.
export default function Alert({ tone = 'error', focus = true, children }) {
  const ref = useRef(null)
  const error = tone === 'error'

  // Errors jump to the first invalid field (or this message). Only plain-text messages trigger it: JSX
  // children are new on every render and would steal focus while the user types.
  useFocusFirstError(focus && error && typeof children === 'string' ? children : null)

  // Bring other new messages into view; on long forms they would otherwise appear below the fold
  useEffect(() => {
    if (!error) ref.current?.scrollIntoView?.({ block: 'nearest' })
  }, [children, error])

  if (!children) return null
  return (
    <div ref={ref} className={`alert alert--${tone}`} role={error ? 'alert' : 'status'}>
      {children}
    </div>
  )
}
