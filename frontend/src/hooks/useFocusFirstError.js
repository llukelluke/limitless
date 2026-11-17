import { useEffect } from 'react'

const MESSAGES = '.alert--error, .field__error, .auth-field__error, .forgot-password-error'

// Puts the cursor in the first field marked invalid and centers it on screen.
// With no field marked (e.g. a server error), centers the first error message instead.
export function focusFirstError() {
  const field = document.querySelector('[aria-invalid="true"]')
  const target = field ?? document.querySelector(MESSAGES)
  if (!target) return
  target.scrollIntoView({ block: 'center' })
  field?.focus({ preventScroll: true })
}

// Runs focusFirstError whenever `error` changes to a non-empty value.
export default function useFocusFirstError(error) {
  useEffect(() => {
    if (error) focusFirstError()
  }, [error])
}
