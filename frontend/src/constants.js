export const ROLES = [
  { value: 'ADMINISTRATOR', label: 'Administrator' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'ACCOUNTANT', label: 'Accountant' },
]

export const STATUSES = [
  { value: 'ACTIVATED', label: 'Active' },
  { value: 'DEACTIVATED', label: 'Deactivated' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'PENDING', label: 'Pending' },
]

// Users answer these when requesting access; forgot-password asks them back.
export const SECURITY_QUESTIONS = [
  'What was the name of your first school?',
  'What city were you born in?',
  'What was the make of your first car?',
]

// Account numbers start with their category's digit (as covered in class).
export const ACCOUNT_CATEGORIES = [
  { value: 'Asset', label: 'Asset', prefix: '1', side: 'LEFT' },
  { value: 'Liability', label: 'Liability', prefix: '2', side: 'RIGHT' },
  { value: 'Equity', label: 'Equity', prefix: '3', side: 'RIGHT' },
  { value: 'Revenue', label: 'Revenue', prefix: '4', side: 'RIGHT' },
  { value: 'Expense', label: 'Expense', prefix: '5', side: 'LEFT' },
]

export const NORMAL_SIDES = [
  { value: 'LEFT', label: 'Debit' },
  { value: 'RIGHT', label: 'Credit' },
]

export const STATEMENTS = [
  { value: 'INCOME_STATEMENT', label: 'IS', name: 'Income Statement' },
  { value: 'BALANCE_SHEET', label: 'BS', name: 'Balance Sheet' },
  { value: 'RETAINED_EARNINGS', label: 'RE', name: 'Retained Earnings Statement' },
]

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

// 1250.5 → "$1,250.50"
export const formatMoney = (value) =>
  value === null || value === undefined || value === '' ? '—' : money.format(Number(value))

// Text typed into a money field → number, or NaN unless it's an amount with at most two decimals.
export function parseMoney(text) {
  const plain = String(text ?? '').replace(/[$,\s]/g, '')
  if (plain === '') return 0
  return /^-?\d{1,13}(\.\d{1,2})?$/.test(plain) ? Number(plain) : NaN
}

// "2026-10-18T14:05:00" → "Oct. 18, 2026, 2:05 PM"
export function formatDateTime(iso) {
  if (!iso) return '—'
  const [date, time = '00:00'] = iso.split('T')
  const [hours, minutes] = time.split(':').map(Number)
  const suffix = hours >= 12 ? 'PM' : 'AM'
  return `${formatDate(date)}, ${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${suffix}`
}

// Order 1 → "01"
export const formatOrder = (order) => (order === null || order === undefined ? '—' : String(order).padStart(2, '0'))

export const isAdmin = (user) => user?.role === 'ADMINISTRATOR'

export const homePathFor = (user) => (user?.role === 'ADMINISTRATOR' ? '/admin' : '/home')

export const labelFor = (options, value) =>
  options.find((option) => option.value === value)?.label ?? value ?? '—'

export const fullName = (person) => [person.first_name, person.last_name].filter(Boolean).join(' ')

// Approved accounts have a username; pending or rejected requests do not.
export const isSystemUser = (user) => Boolean(user.username)

const MONTHS = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.']

// "2026-10-03" → "Oct. 3, 2026" (parsed as a calendar date, so no timezone shift)
export function formatDate(isoDate) {
  if (!isoDate) return '—'
  const [year, month, day] = isoDate.split('-').map(Number)
  return `${MONTHS[month - 1]} ${day}, ${year}`
}

export function todayIso() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export const isPasswordExpired = (user) => Boolean(user.password_expiry) && user.password_expiry < todayIso()

export const passwordStatus = (user) => {
  if (!user.password_expiry) return '—'
  return isPasswordExpired(user) ? 'Expired' : 'Valid'
}

// Sprint 1 rules: 8+ characters, starts with a letter, includes a letter, a number and a special character.
export function passwordProblems(password) {
  const problems = []
  if (password.length < 8) problems.push('be at least 8 characters')
  if (!/^[A-Za-z]/.test(password)) problems.push('start with a letter')
  if (!/\d/.test(password)) problems.push('include a number')
  if (!/[^A-Za-z0-9]/.test(password)) problems.push('include a special character')
  return problems
}

// FormData → plain object, trimming text and turning empty strings into null.
export function formValues(form) {
  return Object.fromEntries(
    [...new FormData(form).entries()].map(([key, value]) => {
      const text = typeof value === 'string' ? value.trim() : value
      return [key, text === '' ? null : text]
    }),
  )
}
