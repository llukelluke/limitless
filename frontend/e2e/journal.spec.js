// Sprint 3: journalizing, approval, ledger and email, against the real backend (MySQL + Spring Boot + `npm run dev`).
// beforeAll creates this run's own users, accounts and entries, so the suite can be re-run on the same database.
// E2E_EVIDENCE_DIR=… keeps a screenshot per test for the test-case document.
import { expect, test } from '@playwright/test'
import { ADMIN, adminToken, createAccount, createUser, evidence, uniqueAccount, uniquePerson } from './helpers.js'

test.describe.configure({ mode: 'serial' })

const ERROR_RED = 'rgb(138, 31, 18)'
const problems = (page) => page.locator('.form-feedback .alert')
const submit = (page) => page.getByRole('button', { name: 'Submit for Approval' })
const refs = (page) => page.locator('tbody tr td:first-child')
const today = new Date().toISOString().slice(0, 10)

// W = this run's world: users (with tokens), accounts, and the six seeded entries e1…e6.
const W = {}
const label = (a) => `${a.number} · ${a.name}`
const fullName = (u) => `${u.first} ${u.last}`
const ref = (id) => `JE-${id}`

async function api(request, token, method, path, data) {
  const response = await request.fetch(`/api${path}`, { method, headers: { Authorization: `Bearer ${token}` }, data })
  return { status: response.status(), body: await response.json().catch(() => null) }
}

// Create → upload → submit, the same calls the form makes. lines: [[account, 'DEBIT'|'CREDIT', amount], …]
async function submitEntry(request, who, { date, lines, description = null, files = [] }) {
  const body = { entry_date: date, entry_type: 'REGULAR', description, lines: lines.map(([a, side, amount]) => ({ account_id: a.id, side, amount })) }
  const created = await api(request, who.token, 'POST', '/journal-entries', body)
  expect(created.status, JSON.stringify(created.body)).toBe(201)
  for (const name of files) {
    const response = await request.post(`/api/journal-entries/${created.body.id}/attachments`, {
      headers: { Authorization: `Bearer ${who.token}` },
      multipart: { file: { name, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') } },
    })
    expect(response.status()).toBe(201)
  }
  expect((await api(request, who.token, 'POST', `/journal-entries/${created.body.id}/submit`)).status).toBe(200)
  return created.body.id
}

const review = async (request, id, action, comment) =>
  expect((await api(request, W.manager.token, 'PUT', `/journal-entries/${id}/${action}`, comment && { comment })).status).toBe(200)

// Signs `who` in with a real token, the way the login page stores it.
async function as(page, who) {
  const { token, ...user } = who.session
  await page.addInitScript((value) => localStorage.setItem('limitless.session', value), JSON.stringify({ token, user }))
}

// Records the API calls the page makes, e.g. "POST /api/journal-entries".
function recordCalls(page) {
  const calls = []
  page.on('request', (r) => r.url().includes('/api/') && calls.push(`${r.method()} ${new URL(r.url()).pathname}`))
  return calls
}

async function line(page, side, n, account, amount) {
  const which = side.toLowerCase()
  if (account) await page.getByLabel(`Account for ${which} line ${n}`).selectOption({ label: label(account) })
  if (amount !== undefined) await page.getByLabel(`Amount for ${which} line ${n}`).fill(amount)
}

async function newEntry(page) {
  await page.goto('/journal/new')
  await expect(page.getByLabel('Account for debit line 1')).toBeVisible()
}

// Search box narrowed to this run's accounts, dated before today so entries made by the tests don't show.
async function onlySeeded(page) {
  await page.getByLabel('Search by account name, amount or date').fill(W.tag)
  await page.getByLabel('To date').fill('2026-11-02')
}

test.beforeAll(async ({ request }) => {
  const user = async (first, role) => {
    const person = uniquePerson(first)
    const created = await createUser(request, person, role)
    const login = await request.post('/api/auth/login', { data: { username: created.username, password: created.password } })
    const session = await login.json()
    return { ...person, ...created, session, token: session.token }
  }
  W.manager = await user('Maria', 'MANAGER')
  W.accountant = await user('Jamie', 'ACCOUNTANT')
  W.accountant2 = await user('Taylor', 'ACCOUNTANT')
  W.adminToken = await adminToken(request)

  // Account names share one tag so a search can narrow every list to this run.
  W.tag = `T${Date.now().toString(36)}`
  const account = async (name, prefix, fields) => {
    const a = uniqueAccount(name, prefix)
    return createAccount(request, { ...a, name: `${name} ${W.tag}` }, fields)
  }
  const income = (category, normal_side) => ({ category, subcategory: category, normal_side, statement: 'INCOME_STATEMENT' })
  W.cash = await account('Cash', '1', { initial_balance: '1000' })
  W.ar = await account('Receivable', '1')
  W.supplies = await account('Supplies', '1', { initial_balance: '250' })
  W.payable = await account('Payable', '2', { category: 'Liability', subcategory: 'Current Liabilities', normal_side: 'RIGHT' })
  W.revenue = await account('Revenue', '4', income('Revenue', 'RIGHT'))
  W.rent = await account('Rent', '5', income('Expense', 'LEFT'))
  W.old = await account('Retired', '1')
  expect((await api(request, W.adminToken, 'PUT', `/accounts/${W.old.id}/deactivate`)).status).toBe(200)

  const { accountant: A, accountant2: B, manager: M } = W
  W.e1 = await submitEntry(request, A, { date: '2026-10-05', description: 'Cash received for consulting', lines: [[W.cash, 'DEBIT', 500], [W.revenue, 'CREDIT', 500]] })
  W.e2 = await submitEntry(request, B, { date: '2026-10-12', lines: [[W.rent, 'DEBIT', 200], [W.cash, 'CREDIT', 200]] })
  W.e3 = await submitEntry(request, M, { date: '2026-10-15', lines: [[W.ar, 'DEBIT', 300], [W.revenue, 'CREDIT', 300]] })
  W.e4 = await submitEntry(request, A, { date: '2026-10-20', lines: [[W.supplies, 'DEBIT', 75], [W.cash, 'CREDIT', 75]] })
  W.e5 = await submitEntry(request, A, { date: '2026-10-28', files: ['invoice-1042.pdf'], lines: [[W.ar, 'DEBIT', 1250], [W.revenue, 'CREDIT', 1250]] })
  W.e6 = await submitEntry(request, B, { date: '2026-11-01', lines: [[W.supplies, 'DEBIT', 60], [W.rent, 'DEBIT', 40], [W.cash, 'CREDIT', 100]] })
  for (const id of [W.e1, W.e2, W.e3]) await review(request, id, 'approve')
  await review(request, W.e4, 'reject', 'Missing the supplier receipt.')
})

test.describe('Journal entries: create (accountant and manager)', () => {
  test('TC-JE-01 (P): accountant submits an entry with multiple debits, a credit and attachments', async ({ page, request }) => {
    await as(page, W.accountant)
    await page.goto('/journal')
    await page.getByRole('link', { name: 'New Journal Entry' }).click()
    await line(page, 'DEBIT', 1, W.supplies, '120.50')
    await page.getByRole('button', { name: 'Add Debit' }).click()
    await line(page, 'DEBIT', 2, W.rent, '879.50')
    await line(page, 'CREDIT', 1, W.cash, '1,000')
    await expect(page.locator('.journal-side__total').first()).toHaveText('Total debits: $1,000.00')
    await page.getByLabel(/ATTACH FILES/).setInputFiles([
      { name: 'receipt.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF') },
      { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('png') },
    ])
    await submit(page).click()

    await expect(page).toHaveURL(/\/journal\/\d+$/)
    await expect(page.locator('.alert')).toHaveText('Journal entry submitted for approval.')
    await expect(page.locator('.journal-status')).toHaveText('Pending')
    await expect(page.locator('tbody tr td:first-child')).toHaveText([label(W.supplies), label(W.rent), label(W.cash), 'Totals'])
    await expect(page.getByRole('button', { name: 'receipt.pdf' })).toBeVisible()
    const saved = (await api(request, W.accountant.token, 'GET', `/journal-entries/${page.url().split('/').pop()}`)).body
    expect(saved.status).toBe('SUBMITTED')
    expect(saved.lines.map((l) => l.side)).toEqual(['DEBIT', 'DEBIT', 'CREDIT'])
    expect(saved.attachments.map((a) => a.original_name)).toEqual(['receipt.pdf', 'photo.png'])
    await evidence(page, 'S01')
  })

  test('TC-JE-02 (P): manager submits a journal entry', async ({ page, request }) => {
    await as(page, W.manager)
    await newEntry(page)
    await page.getByLabel('TYPE').selectOption('ADJUSTING')
    await line(page, 'DEBIT', 1, W.rent, '450')
    await line(page, 'CREDIT', 1, W.payable, '450')
    await submit(page).click()
    await expect(page.locator('.alert')).toHaveText('Journal entry submitted for approval.')
    await expect(page.getByLabel('PREPARED BY')).toHaveValue(fullName(W.manager))
    const saved = (await api(request, W.manager.token, 'GET', `/journal-entries/${page.url().split('/').pop()}`)).body
    expect(saved.entry_type).toBe('ADJUSTING')
    await evidence(page, 'S02')
  })

  test('TC-JE-03 (P/N): only active chart-of-accounts accounts can be chosen', async ({ page }) => {
    await as(page, W.accountant)
    await newEntry(page)
    const options = page.getByLabel('Account for debit line 1').locator('option')
    const texts = await options.allTextContents()
    for (const a of [W.cash, W.ar, W.supplies, W.payable, W.revenue, W.rent]) expect(texts).toContain(label(a))
    expect(texts).not.toContain(label(W.old))
    await page.getByLabel('Account for debit line 1').focus()
    await evidence(page, 'S03')
  })

  test('TC-JE-04 (N): unbalanced entry shows a red error and cannot be submitted', async ({ page }) => {
    await as(page, W.accountant)
    const calls = recordCalls(page)
    await newEntry(page)
    await line(page, 'DEBIT', 1, W.cash, '100')
    await line(page, 'CREDIT', 1, W.revenue, '90')
    await submit(page).click()
    await expect(problems(page)).toHaveText('Total debits (100.00) must equal total credits (90.00). The difference is 10.00.')
    await expect(problems(page)).toHaveCSS('color', ERROR_RED)
    await expect(submit(page)).toBeDisabled()
    expect(calls).not.toContain('POST /api/journal-entries')
    await evidence(page, 'S04')
  })

  test('TC-JE-05 (P): error goes away once the cause is fixed', async ({ page, request }) => {
    await as(page, W.accountant)
    await newEntry(page)
    await line(page, 'DEBIT', 1, W.cash, '100')
    await line(page, 'CREDIT', 1, W.revenue, '90')
    await submit(page).click()
    await expect(problems(page)).toBeVisible()
    await line(page, 'CREDIT', 1, undefined, '100')
    await expect(problems(page)).toHaveCount(0)
    await expect(submit(page)).toBeEnabled()
    await evidence(page, 'S05')
    await submit(page).click()
    await expect(page.locator('.alert')).toHaveText('Journal entry submitted for approval.')
    const saved = (await api(request, W.accountant.token, 'GET', `/journal-entries/${page.url().split('/').pop()}`)).body
    expect(saved.lines.map((l) => l.amount)).toEqual([100, 100])
  })

  test('TC-JE-06 (N): an entry needs at least one debit and one credit', async ({ page }) => {
    await as(page, W.accountant)
    await newEntry(page)
    await line(page, 'DEBIT', 1, W.cash, '100')
    await page.getByRole('button', { name: 'Remove credit line 1' }).click()
    await submit(page).click()
    await expect(problems(page)).toHaveText('A journal entry must have at least one credit.')
    await page.getByRole('button', { name: 'Remove debit line 1' }).click()
    await expect(problems(page)).toContainText('Add at least one debit line and one credit line.')
    await evidence(page, 'S06')
  })

  test('TC-JE-07 (N): missing account and bad amounts name the line to fix', async ({ page }) => {
    await as(page, W.accountant)
    await newEntry(page)
    await line(page, 'DEBIT', 1, undefined, 'abc')
    await line(page, 'CREDIT', 1, W.cash, '-5')
    await page.getByLabel('DATE').fill('')
    await submit(page).click()
    for (const text of [
      'A journal entry date is required.',
      'Line 1: select an account.',
      'Line 1: enter an amount.',
      'Line 2: the amount must be greater than zero.',
    ]) await expect(problems(page)).toContainText(text)
    await line(page, 'DEBIT', 1, undefined, '10.555')
    await expect(problems(page)).toContainText('Line 1: amounts can have at most two decimal places.')
    await evidence(page, 'S07')
  })

  test('TC-JE-08 (N): a deactivated account is refused by the server', async ({ request }) => {
    // The form only lists active accounts (TC-JE-03); this checks the server enforces it too.
    const body = { entry_date: today, entry_type: 'REGULAR', lines: [{ account_id: W.old.id, side: 'DEBIT', amount: 5 }, { account_id: W.cash.id, side: 'CREDIT', amount: 5 }] }
    const result = (await api(request, W.accountant.token, 'POST', '/journal-entries/validate', body)).body
    expect(result.valid).toBe(false)
    expect(result.errors.map((e) => e.code)).toContain('JRN_008')
  })

  test('TC-JE-09 (N): attachments must be pdf, word, excel, csv, jpg or png', async ({ page, request }) => {
    await as(page, W.accountant)
    await newEntry(page)
    await line(page, 'DEBIT', 1, W.cash, '50')
    await line(page, 'CREDIT', 1, W.revenue, '50')
    await page.getByLabel(/ATTACH FILES/).setInputFiles([
      { name: 'ledger.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('x') },
      { name: 'setup.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('x') },
    ])
    await submit(page).click()
    await expect(problems(page)).toHaveText('Attachments must be PDF, Word, Excel, CSV, JPG, or PNG files.')
    await expect(page).toHaveURL(/\/journal\/new$/)
    // The half-made draft is cancelled, so nothing is left behind
    expect((await api(request, W.accountant.token, 'GET', '/journal-entries?status=DRAFT')).body).toEqual([])
    await evidence(page, 'S09')
    await page.getByRole('button', { name: 'Remove setup.exe' }).click()
    await submit(page).click()
    await expect(page.locator('.alert')).toHaveText('Journal entry submitted for approval.')
    await expect(page.getByRole('button', { name: 'ledger.xlsx' })).toBeVisible()
  })

  test('TC-JE-10 (P): error text comes from the error_messages table and is red', async ({ page }) => {
    await as(page, W.accountant)
    await newEntry(page)
    await line(page, 'DEBIT', 1, W.cash, '20')
    await line(page, 'CREDIT', 1, W.revenue, '10')
    const validated = page.waitForResponse((r) => r.url().endsWith('/api/journal-entries/validate'))
    await submit(page).click()
    const { errors } = await (await validated).json()
    expect(errors.map((e) => e.code)).toEqual(['JRN_005'])
    await expect(problems(page)).toHaveText(errors[0].message)
    await expect(problems(page)).toHaveCSS('color', ERROR_RED)
    await evidence(page, 'S10')
  })

  test('TC-JE-11 (P): Reset clears the entry before it is submitted', async ({ page }) => {
    await as(page, W.accountant)
    const calls = recordCalls(page)
    await newEntry(page)
    await line(page, 'DEBIT', 1, W.cash, '50')
    await page.getByRole('button', { name: 'Add Debit' }).click()
    await page.getByLabel('DESCRIPTION').fill('Wrong entry')
    await page.getByRole('button', { name: 'Reset' }).click()
    await expect(page.getByLabel('Account for debit line 1')).toHaveValue('')
    await expect(page.getByLabel('Amount for debit line 1')).toHaveValue('')
    await expect(page.getByLabel('Account for debit line 2')).toHaveCount(0)
    await expect(page.getByLabel('DESCRIPTION')).toHaveValue('')
    expect(calls).not.toContain('POST /api/journal-entries')
    await evidence(page, 'S11')
  })

  test('TC-JE-12 (P): Cancel leaves without saving', async ({ page }) => {
    await as(page, W.accountant)
    const calls = recordCalls(page)
    await newEntry(page)
    await line(page, 'DEBIT', 1, W.cash, '50')
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page).toHaveURL(/\/journal$/)
    expect(calls).not.toContain('POST /api/journal-entries')
  })

  test('TC-JE-13 (N): a submitted entry cannot be deleted, edited or approved by the accountant', async ({ page, request }) => {
    await as(page, W.accountant)
    await page.goto(`/journal/${W.e5}`)
    await expect(page.locator('.journal-status')).toHaveText('Pending')
    await expect(page.locator('.journal-status')).toHaveCSS('background-color', 'rgb(251, 239, 196)')
    for (const name of ['Delete', 'Edit', 'Approve', 'Reject']) await expect(page.getByRole('button', { name })).toHaveCount(0)
    expect((await api(request, W.accountant.token, 'DELETE', `/journal-entries/${W.e5}`)).status).toBe(409)
    expect((await api(request, W.accountant.token, 'PUT', `/journal-entries/${W.e5}/approve`)).status).toBe(403)
    await evidence(page, 'S12')
  })

  test('TC-JE-14 (N): an error from the server is shown and the form is kept', async ({ page }) => {
    await as(page, W.accountant)
    // Fault injection: the create call fails once, as if the database were down
    await page.route((url) => url.pathname === '/api/journal-entries', (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Internal Server Error', message: 'Database unavailable.' }) })
        : route.continue(),
    )
    await newEntry(page)
    await line(page, 'DEBIT', 1, W.cash, '25')
    await line(page, 'CREDIT', 1, W.revenue, '25')
    await submit(page).click()
    await expect(problems(page)).toHaveText('Database unavailable.')
    await expect(page).toHaveURL(/\/journal\/new$/)
    await expect(page.getByLabel('Amount for debit line 1')).toHaveValue('25')
  })

  test('TC-JE-15 (N): administrators cannot create journal entries', async ({ page, request }) => {
    const admin = await (await request.post('/api/auth/login', { data: ADMIN })).json()
    await as(page, { session: admin })
    await page.goto('/journal/new')
    await expect(page).toHaveURL(/\/journal$/)
    await expect(page.getByRole('link', { name: 'New Journal Entry' })).toHaveCount(0)
    const body = { entry_date: today, entry_type: 'REGULAR', lines: [] }
    expect((await api(request, admin.token, 'POST', '/journal-entries', body)).status).toBe(403)
  })
})

test.describe('Journal entries: manager approval', () => {
  test('TC-APR-01 (P): manager is notified of entries waiting for approval', async ({ page, request }) => {
    const { count } = (await api(request, W.manager.token, 'GET', '/journal-entries/pending-count')).body
    await as(page, W.manager)
    await page.goto('/home')
    await expect(page.locator('.alert')).toContainText(`${count} journal entries are waiting for your approval.`)
    await evidence(page, 'S13')
    await page.getByRole('link', { name: 'Review pending entries →' }).click()
    await expect(page.getByLabel('Filter by status')).toHaveValue('SUBMITTED')
    await onlySeeded(page)
    await expect(refs(page)).toHaveText([ref(W.e6), ref(W.e5)])
  })

  test('TC-APR-02 (N): accountants do not see the approval notice', async ({ page }) => {
    await as(page, W.accountant)
    await page.goto('/home')
    await expect(page.getByRole('heading', { name: `Welcome, ${W.accountant.username}` })).toBeVisible()
    await expect(page.locator('.alert')).toHaveCount(0)
  })

  test('TC-APR-03 (P): manager approves a pending entry', async ({ page, request }) => {
    const id = await submitEntry(request, W.accountant, { date: today, lines: [[W.ar, 'DEBIT', 80], [W.revenue, 'CREDIT', 80]] })
    await as(page, W.manager)
    await page.goto(`/journal/${id}`)
    await page.getByRole('button', { name: 'Approve' }).click()
    await expect(page.locator('.alert')).toHaveText('Entry approved and posted to the ledger.')
    await expect(page.locator('.journal-status')).toHaveText('Approved')
    await expect(page.locator('.journal-status')).toHaveCSS('background-color', 'rgb(227, 241, 223)')
    await expect(page.getByLabel('REVIEWED BY')).toHaveValue(fullName(W.manager))
    await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0)
    await evidence(page, 'S14')
  })

  test('TC-APR-04 (N): rejecting without a reason is blocked', async ({ page, request }) => {
    await as(page, W.manager)
    const calls = recordCalls(page)
    await page.goto(`/journal/${W.e6}`)
    await page.getByRole('button', { name: 'Reject' }).click()
    await expect(page.getByRole('button', { name: 'Confirm Rejection' })).toBeDisabled()
    await page.getByLabel(/REASON FOR REJECTION/).fill('   ')
    await expect(page.getByRole('button', { name: 'Confirm Rejection' })).toBeDisabled()
    expect(calls.some((c) => c.endsWith('/reject'))).toBeFalsy()
    // The server refuses it too
    const blank = await api(request, W.manager.token, 'PUT', `/journal-entries/${W.e6}/reject`, { comment: ' ' })
    expect(blank.status).toBe(400)
    expect(blank.body.message).toBe('A reason is required when rejecting a journal entry.')
    await evidence(page, 'S15')
  })

  test('TC-APR-05 (P): manager rejects with a reason', async ({ page, request }) => {
    const id = await submitEntry(request, W.accountant2, { date: today, lines: [[W.rent, 'DEBIT', 900], [W.payable, 'CREDIT', 900]] })
    await as(page, W.manager)
    await page.goto(`/journal/${id}`)
    await page.getByRole('button', { name: 'Reject' }).click()
    await page.getByLabel(/REASON FOR REJECTION/).fill('Rent belongs in October, not November.')
    await page.getByRole('button', { name: 'Confirm Rejection' }).click()
    await expect(page.locator('.alert')).toHaveText('Entry rejected.')
    await expect(page.locator('.journal-status')).toHaveText('Rejected')
    await expect(page.locator('.journal-status')).toHaveCSS('background-color', 'rgb(251, 227, 223)')
    await expect(page.getByLabel('COMMENT')).toHaveValue('Rent belongs in October, not November.')
    await evidence(page, 'S16')
  })
})

test.describe('Journal entries: view, filter and search', () => {
  test('TC-JV-01 (P): view pending, approved and rejected entries', async ({ page }) => {
    await as(page, W.manager)
    await page.goto('/journal')
    await onlySeeded(page)
    await expect(refs(page)).toHaveCount(6)
    const status = page.getByLabel('Filter by status')
    for (const [value, text, count] of [['SUBMITTED', 'Pending', 2], ['REJECTED', 'Rejected', 1], ['APPROVED', 'Approved', 3]]) {
      await status.selectOption(value)
      await expect(page.locator('tbody .journal-status')).toHaveText(Array(count).fill(text))
    }
    await evidence(page, 'S17')
  })

  test('TC-JV-02 (P/N): filter by date range', async ({ page }) => {
    await as(page, W.accountant)
    await page.goto('/journal')
    await page.getByLabel('Search by account name, amount or date').fill(W.tag)
    await page.getByLabel('From date').fill('2026-10-10')
    await page.getByLabel('To date').fill('2026-10-20')
    await expect(refs(page)).toHaveText([ref(W.e4), ref(W.e3), ref(W.e2)])
    await page.getByLabel('Filter by status').selectOption('APPROVED')
    await expect(refs(page)).toHaveText([ref(W.e3), ref(W.e2)])
    await evidence(page, 'S18')
    await page.getByLabel('From date').fill('2025-01-01')
    await page.getByLabel('To date').fill('2025-01-31')
    await expect(page.getByText('No journal entries match these filters.')).toBeVisible()
  })

  test('TC-JV-03 (P/N): search by account name, amount or date', async ({ page }) => {
    await as(page, W.accountant)
    await page.goto('/journal')
    const search = page.getByLabel('Search by account name, amount or date')
    const ours = [W.e1, W.e2, W.e3, W.e4, W.e5, W.e6].map(ref)
    // Other runs share the database, so only this run's entries are compared
    const seen = async () => (await refs(page).allTextContents()).filter((r) => ours.includes(r)).sort()
    await page.getByLabel('To date').fill('2026-11-02')
    for (const [term, expected] of [
      [W.rent.name, [W.e2, W.e6]],
      ['1,250', [W.e5]],
      ['$75.00', [W.e4]],
      ['2026-10-15', [W.e3]],
      ['Oct. 5', [W.e1]],
      ['Payroll', []],
    ]) {
      await search.fill(term)
      await expect.poll(seen, { message: term }).toEqual(expected.map(ref).sort())
    }
    await search.fill(W.rent.name)
    await evidence(page, 'S19')
  })

  test('TC-JV-04 (P): accountant sees entries prepared by the manager and other accountants', async ({ page }) => {
    await as(page, W.accountant)
    await page.goto('/journal')
    await onlySeeded(page)
    const [A, B, M] = [W.accountant, W.accountant2, W.manager].map(fullName)
    await expect(page.locator('tbody tr td:nth-child(7)')).toHaveText([B, A, A, M, B, A])
    await page.getByRole('link', { name: ref(W.e3), exact: true }).first().click()
    await expect(page.getByLabel('PREPARED BY')).toHaveValue(M)
  })
})

test.describe('Ledger', () => {
  test('TC-LED-01 (P): clicking an account name opens its ledger', async ({ page }) => {
    await as(page, W.accountant)
    await page.goto('/accounts')
    await page.getByRole('link', { name: W.cash.name, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/accounts/${W.cash.id}/ledger$`))
    await expect(page.getByRole('heading', { name: label(W.cash) })).toBeVisible()
    await page.goto('/journal')
    await page.getByRole('link', { name: W.revenue.name, exact: true }).first().click()
    await expect(page).toHaveURL(new RegExp(`/accounts/${W.revenue.id}/ledger$`))
  })

  test('TC-LED-02 (P): ledger shows date, description, PR, debit, credit and an accurate running balance', async ({ page }) => {
    await as(page, W.manager)
    await page.goto(`/accounts/${W.cash.id}/ledger`)
    const rows = page.locator('tbody tr')
    await expect(rows).toHaveCount(3) // rejected e4 and pending e6 are not posted
    await expect(rows.nth(0)).toHaveText(/Opening balance\s*\$1,000\.00/)
    await expect(rows.nth(1)).toHaveText(new RegExp(`Oct\\. 5, 2026\\s*Cash received for consulting\\s*${ref(W.e1)}\\s*\\$500\\.00\\s*\\$1,500\\.00`))
    await expect(rows.nth(2)).toHaveText(new RegExp(`Oct\\. 12, 2026\\s*${ref(W.e2)}\\s*\\$200\\.00\\s*\\$1,300\\.00`))
    await expect(page.locator('.ledger-summary')).toContainText('$1,300.00')
    await evidence(page, 'S20')
  })

  test('TC-LED-03 (P): the post reference opens the journal entry that made the posting', async ({ page }) => {
    await as(page, W.accountant)
    await page.goto(`/accounts/${W.cash.id}/ledger`)
    await page.getByRole('link', { name: ref(W.e2), exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/journal/${W.e2}$`))
    await expect(page.getByRole('heading', { name: `Journal Entry ${ref(W.e2)}` })).toBeVisible()
    await expect(page.locator('tbody tr').nth(1)).toContainText(label(W.cash))
    await evidence(page, 'S21')
  })

  test('TC-LED-04 (P/N): ledger filters by date range and searches by amount, description or PR', async ({ page }) => {
    await as(page, W.accountant)
    await page.goto(`/accounts/${W.cash.id}/ledger`)
    const prs = page.locator('tbody tr td:nth-child(3)')
    const search = page.getByLabel('Search by amount, description or post reference')
    await page.getByLabel('From date').fill('2026-10-10')
    await expect(prs).toHaveText(['', ref(W.e2)])
    await expect(page.locator('tbody tr').first()).toContainText('$1,500.00') // opening balance as of the From date
    await page.getByLabel('From date').fill('')
    await search.fill('consulting')
    await expect(prs).toHaveText(['', ref(W.e1)])
    await search.fill('200')
    await expect(prs).toHaveText(['', ref(W.e2)])
    await search.fill('999')
    await expect(prs).toHaveText([''])
    await search.fill('')
    await page.getByLabel('From date').fill('2026-10-01')
    await page.getByLabel('To date').fill('2026-10-06')
    await expect(prs).toHaveText(['', ref(W.e1)])
    await evidence(page, 'S22')
  })

  test('TC-LED-05 (P): an approved entry is reflected in the ledger', async ({ page, request }) => {
    const id = await submitEntry(request, W.accountant2, { date: today, lines: [[W.rent, 'DEBIT', 100], [W.cash, 'CREDIT', 100]] })
    await as(page, W.manager)
    await page.goto(`/accounts/${W.cash.id}/ledger`)
    await expect(page.locator('tbody tr')).toHaveCount(3)
    await page.goto(`/journal/${id}`)
    await page.getByRole('button', { name: 'Approve' }).click()
    await expect(page.locator('.journal-status')).toHaveText('Approved')
    await page.getByRole('link', { name: label(W.cash) }).click()
    const rows = page.locator('tbody tr')
    await expect(rows).toHaveCount(4)
    await expect(rows.nth(3)).toHaveText(new RegExp(`${ref(id)}\\s*\\$100\\.00\\s*\\$1,200\\.00`))
    await evidence(page, 'S23')
  })
})

test.describe('Email and event log', () => {
  test('TC-EM-01 (P/N): accountant emails a manager from the account page; other accountants are not offered', async ({ page }) => {
    await as(page, W.accountant)
    const calls = recordCalls(page)
    await page.goto(`/accounts/${W.cash.id}`)
    await page.getByRole('link', { name: 'Email User' }).click()
    await expect(page).toHaveURL(/\/email$/)
    await expect(page.getByRole('option', { name: `${fullName(W.manager)} (Manager)` })).toBeAttached()
    const options =await page.getByLabel('RECIPIENT').locator('option').allTextContents()
    expect(options).toContain(`${fullName(W.manager)} (Manager)`)
    expect(options.some((o) => o.startsWith(fullName(W.accountant2)))).toBeFalsy()
    await page.getByLabel('RECIPIENT').selectOption({ label: `${fullName(W.manager)} (Manager)` })
    await page.getByLabel('SUBJECT').fill('Question about Cash')
    await page.getByLabel('MESSAGE').fill(`Can you review ${ref(W.e5)} today?`)
    await page.getByRole('button', { name: 'Send Email' }).click()
    await expect(page.locator('.alert')).toHaveText(`Email sent to ${fullName(W.manager)}.`)
    expect(calls).toContain('POST /api/email')
    await evidence(page, 'S24')
  })

  test('TC-EM-02 (N): email needs a recipient, subject and message', async ({ page }) => {
    await as(page, W.accountant)
    const calls = recordCalls(page)
    await page.goto('/email')
    await page.getByLabel('SUBJECT').fill('No recipient')
    await page.getByRole('button', { name: 'Send Email' }).click()
    await expect(page.locator('.alert')).toHaveText('Choose a recipient and enter a subject and message.')
    expect(calls).not.toContain('POST /api/email')
    await evidence(page, 'S25')
  })

  test('TC-EM-03 (P): administrator emails a manager or accountant from the chart of accounts', async ({ page, request }) => {
    const admin = await (await request.post('/api/auth/login', { data: ADMIN })).json()
    await as(page, { session: admin })
    await page.goto('/accounts')
    await page.getByRole('link', { name: 'Email User' }).click()
    await expect(page).toHaveURL(/\/admin\/email$/)
    await page.getByLabel('RECIPIENT').selectOption({ label: `${fullName(W.accountant)} (${W.accountant.username})` })
    await page.getByLabel('SUBJECT').fill('Chart of accounts update')
    await page.getByLabel('MESSAGE').fill('Rent Expense was added.')
    await page.getByRole('button', { name: 'Send Email' }).click()
    await expect(page.locator('.alert')).toHaveText(`Email sent to ${W.accountant.email}.`)
    await evidence(page, 'S26')
  })

  test('TC-LOG-03 (P): manager and accountant see before/after images of account changes', async ({ page }) => {
    await as(page, W.accountant)
    await page.goto(`/accounts/${W.cash.id}`)
    // Approving e1 and e2 changed Cash's balance; each approval logs a MODIFY with before/after images
    const modify = page.locator('tbody tr').filter({ hasText: 'Modified' }).first()
    await expect(modify).toBeVisible()
    await modify.getByText(/Changed: /).click()
    await expect(modify.locator('.event-images__changed').first()).toBeVisible()
    await expect(modify).toContainText(new RegExp(`\\(ID ${W.manager.id}\\)`))
    await evidence(page, 'S27')
  })
})
