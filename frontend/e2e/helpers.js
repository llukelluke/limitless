import { expect } from '@playwright/test'

export const ADMIN = {
  username: process.env.E2E_ADMIN_USER ?? 'sadmin1026',
  password: process.env.E2E_ADMIN_PASSWORD ?? 'Admin123!',
}

export const ANSWERS = ['lincoln', 'atlanta', 'honda']

// Unique per run so the suite can be re-run against the same database
const runId = Date.now().toString(36)
let counter = 0
export function uniquePerson(first = 'Test') {
  counter += 1
  const last = `E2e${runId}${counter}`.replace(/[^a-z0-9]/gi, '')
  return { first, last, email: `${first}.${last}@e2e.example`.toLowerCase() }
}

// Account names and numbers are unique too. Numbers are prefix + 8 digits from the clock and a counter.
export function uniqueAccount(name = 'Cash', prefix = '1') {
  counter += 1
  const digits = String((Date.now() % 1_000_000) * 100 + (counter % 100)).padStart(8, '0').slice(-8)
  return { name: `${name} ${runId}${counter}`, number: `${prefix}${digits}` }
}

export async function signIn(page, username, password) {
  await page.goto('/login')
  await page.getByLabel('Username', { exact: true }).fill(username)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign In' }).click()
}

export async function signInAsAdmin(page) {
  await signIn(page, ADMIN.username, ADMIN.password)
  await expect(page).toHaveURL(/\/admin$/)
}

export async function signOut(page) {
  await page.locator('.user-menu__trigger').click()
  await page.getByRole('menuitem', { name: 'Sign Out' }).click()
  await expect(page).toHaveURL(/\/login$/)
}

export const alert = (page) => page.locator('.alert').first()

// ---------- API shortcuts for test setup ----------

export async function adminToken(request) {
  const response = await request.post('/api/auth/login', { data: ADMIN })
  expect(response.ok(), 'admin login for test setup').toBeTruthy()
  return (await response.json()).token
}

// Requests access with the standard security answers. Returns the pending request id.
export async function requestAccess(request, person) {
  const response = await request.post('/api/auth/access-requests', {
    data: {
      first_name: person.first,
      last_name: person.last,
      email_address: person.email,
      home_address: '1 Test Street',
      birth_date: '2000-01-01',
      security_question1: 'Q1',
      security_question2: 'Q2',
      security_question3: 'Q3',
      security_answer1: ANSWERS[0],
      security_answer2: ANSWERS[1],
      security_answer3: ANSWERS[2],
    },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).id
}

// Creates a user as admin. Returns { id, username, password }.
export async function createUser(request, person, role = 'ACCOUNTANT') {
  const token = await adminToken(request)
  const response = await request.post('/api/users', {
    headers: { Authorization: `Bearer ${token}` },
    data: { first_name: person.first, last_name: person.last, email_address: person.email, role },
  })
  expect(response.status()).toBe(201)
  const { user, temporary_password } = await response.json()
  return { id: user.id, username: user.username, password: temporary_password }
}

// Requests access (so the user has security answers) and approves it. Returns { id, username }.
export async function approvedUser(request, person, role = 'ACCOUNTANT') {
  const id = await requestAccess(request, person)
  const token = await adminToken(request)
  const response = await request.put(`/api/auth/access-requests/${id}/approve?role=${role}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(response.ok()).toBeTruthy()
  return { id, username: (await response.json()).username }
}

// Sets a known password through the forgot-password API. Returns the new password.
export async function setPassword(request, user, email, password = 'Known123!') {
  const forgot = await request.post('/api/auth/forgot-password', {
    data: {
      username: user.username,
      email_address: email,
      security_answer1: ANSWERS[0],
      security_answer2: ANSWERS[1],
      security_answer3: ANSWERS[2],
    },
  })
  expect(forgot.ok()).toBeTruthy()
  const { reset_token } = await forgot.json()
  const reset = await request.post('/api/auth/reset-password', { data: { reset_token, new_password: password } })
  expect(reset.ok()).toBeTruthy()
  return password
}

// Creates an account as admin. Returns the AccountResponse.
export async function createAccount(request, account, fields = {}) {
  const token = await adminToken(request)
  const response = await request.post('/api/accounts', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      name: account.name,
      number: account.number,
      category: 'Asset',
      subcategory: 'Current Assets',
      normal_side: 'LEFT',
      statement: 'BALANCE_SHEET',
      order: '01',
      initial_balance: '0',
      ...fields,
    },
  })
  expect(response.status()).toBe(201)
  return response.json()
}
