// Thin fetch wrapper for the Spring Boot API (see API_CONTRACT.md).

const SESSION_KEY = 'limitless.session'

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
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
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (session) headers.Authorization = `Bearer ${session.token}`

  let response
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
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
    throw new ApiError(response.status, data?.message ?? `Request failed (${response.status}).`)
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
  sendEmail: (id, body) => request(`/users/${id}/send-email`, { method: 'POST', body }),

  allUsersReport: () => request('/users/reports/all'),
  expiredPasswordsReport: () => request('/users/reports/expired-passwords'),

  listAccounts: () => request('/accounts'),
  getAccount: (id) => request(`/accounts/${id}`),
  createAccount: (body) => request('/accounts', { method: 'POST', body }),
  updateAccount: (id, body) => request(`/accounts/${id}`, { method: 'PUT', body }),
  deactivateAccount: (id) => request(`/accounts/${id}/deactivate`, { method: 'PUT' }),
  eventLogs: (table, recordId) => request(`/event-logs${query({ table, record_id: recordId })}`),
}
