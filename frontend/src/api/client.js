// Thin fetch wrapper for the Spring Boot API (see API_CONTRACT.md).

const SESSION_KEY = 'limitless.session'

export class ApiError extends Error {
  constructor(status, message, errors = []) {
    super(message)
    this.status = status
    this.errors = errors // journal validation: [{ code, message }] from the error_messages table
  }
}

let onUnauthorized = () => {}

// AuthProvider registers this so an expired or invalid token signs the user out.
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

export function loadSession() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY))
    return session && !isExpired(session.token) ? session : null
  } catch {
    return null
  }
}

export function saveSession(session) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    // Storage unavailable (private mode); the session just won't survive a reload.
  }
}

function isExpired(token) {
  try {
    const { exp } = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return exp * 1000 <= Date.now()
  } catch {
    return true
  }
}

function parseJson(text) {
  try {
    return text ? JSON.parse(text) : null
  } catch {
    return null
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const session = loadSession()
  const headers = {}
  // FormData (file uploads) sets its own multipart Content-Type
  const form = body instanceof FormData
  if (body !== undefined && !form) headers['Content-Type'] = 'application/json'
  if (session) headers.Authorization = `Bearer ${session.token}`

  let response
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined || form ? body : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'Unable to reach the server. Please make sure the backend is running.')
  }

  const data = parseJson(await response.text())

  if (!response.ok) {
    // Spring Security answers a missing/expired token with an empty 401/403.
    if (session && (response.status === 401 || response.status === 403) && !data?.message) {
      onUnauthorized()
      throw new ApiError(response.status, 'Your session has expired. Please sign in again.')
    }
    throw new ApiError(response.status, data?.message ?? `Request failed (${response.status}).`, data?.errors)
  }
  return data
}

const query = (params) => {
  const search = new URLSearchParams(Object.entries(params).filter(([, value]) => value))
  return search.size ? `?${search}` : ''
}

export const api = {
  login: (username, password) => request('/auth/login', { method: 'POST', body: { username, password } }),

  requestAccess: (body) => request('/auth/access-requests', { method: 'POST', body }),
  approveRequest: (id, role) =>
    request(`/auth/access-requests/${id}/approve${query({ role })}`, { method: 'PUT' }),
  rejectRequest: (id) => request(`/auth/access-requests/${id}/reject`, { method: 'PUT' }),

  forgotPassword: (body) => request('/auth/forgot-password', { method: 'POST', body }),
  resetPassword: (body) => request('/auth/reset-password', { method: 'POST', body }),

  listUsers: () => request('/users'),
  getUser: (id) => request(`/users/${id}`),
  createUser: (body) => request('/users', { method: 'POST', body }),
  updateUser: (id, body) => request(`/users/${id}`, { method: 'PUT', body }),
  activateUser: (id) => request(`/users/${id}/activate`, { method: 'PUT' }),
  deactivateUser: (id) => request(`/users/${id}/deactivate`, { method: 'PUT' }),
  suspendUser: (id, body) => request(`/users/${id}/suspend`, { method: 'PUT', body }),
  issueTemporaryPassword: (id) => request(`/users/${id}/temporary-password`, { method: 'POST' }),
  sendEmail: (id, body) => request(`/users/${id}/send-email`, { method: 'POST', body }),

  allUsersReport: () => request('/users/reports/all'),
  expiredPasswordsReport: () => request('/users/reports/expired-passwords'),

  listAccounts: () => request('/accounts'),
  getAccount: (id) => request(`/accounts/${id}`),
  createAccount: (body) => request('/accounts', { method: 'POST', body }),
  updateAccount: (id, body) => request(`/accounts/${id}`, { method: 'PUT', body }),
  deactivateAccount: (id) => request(`/accounts/${id}/deactivate`, { method: 'PUT' }),
  eventLogs: (table, recordId) => request(`/event-logs${query({ table, record_id: recordId })}`),

  // Email from the account pages: recipients the signed-in user may email.
  emailRecipients: () => request('/email/recipients'),
  emailUser: (body) => request('/email', { method: 'POST', body }),

  // filters: { status, from, to, search }
  listJournalEntries: (filters = {}) => request(`/journal-entries${query(filters)}`),
  pendingJournalCount: () => request('/journal-entries/pending-count'),
  getJournalEntry: (id) => request(`/journal-entries/${id}`),
  validateJournalEntry: (body) => request('/journal-entries/validate', { method: 'POST', body }),
  // Saves a DRAFT; submitJournalEntry sends it for approval.
  createJournalEntry: (body) => request('/journal-entries', { method: 'POST', body }),
  cancelJournalEntry: (id) => request(`/journal-entries/${id}`, { method: 'DELETE' }),
  submitJournalEntry: (id) => request(`/journal-entries/${id}/submit`, { method: 'POST' }),
  uploadAttachment: (id, file) => {
    const form = new FormData()
    form.append('file', file)
    return request(`/journal-entries/${id}/attachments`, { method: 'POST', body: form })
  },
  approveJournalEntry: (id) => request(`/journal-entries/${id}/approve`, { method: 'PUT' }),
  rejectJournalEntry: (id, comment) => request(`/journal-entries/${id}/reject`, { method: 'PUT', body: { comment } }),
  // filters: { from, to, search }
  getLedger: (id, filters = {}) => request(`/accounts/${id}/ledger${query(filters)}`),
  downloadAttachment,
}

// Attachments need the auth header, so a plain <a href> can't fetch them.
async function downloadAttachment(entryId, attachment) {
  const session = loadSession()
  const response = await fetch(`/api/journal-entries/${entryId}/attachments/${attachment.id}`, {
    headers: session ? { Authorization: `Bearer ${session.token}` } : {},
  })
  if (!response.ok) throw new ApiError(response.status, `Could not download ${attachment.original_name}.`)
  const url = URL.createObjectURL(await response.blob())
  const link = Object.assign(document.createElement('a'), { href: url, download: attachment.original_name })
  link.click()
  URL.revokeObjectURL(url)
}
