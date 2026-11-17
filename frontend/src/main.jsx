import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import { focusFirstError } from './hooks/useFocusFirstError.js'

// After any form submit, jump to the first error, even when it is the same error as last time.
document.addEventListener('submit', () => requestAnimationFrame(focusFirstError))

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
