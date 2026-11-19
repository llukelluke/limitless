// Sprint 4: financial statements, adjusting entries, report → ledger links, error highlighting, and email
// (any role to any role, attachments). Runs against the real backend (MySQL + Spring Boot + `npm run dev`).
// beforeAll creates this run's own users, accounts and entries, so the suite can be re-run on the same database.
// E2E_EVIDENCE_DIR=… keeps a screenshot per test (named after the test case) for the test-case document.
import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import {
  ADMIN,
  adminToken,
  api,
  approvedUser,
  as,
  createAccount,
  createUser,
  evidence,
  requestAccess,
  submitEntry,
  uniqueAccount,
  uniquePerson,
} from './helpers.js'

test.describe.configure({ mode: 'serial' })

const ERROR_RED = 'rgb(180, 35, 24)'
const AUTH_ERROR_RED = 'rgb(180, 35, 24)'
const PERIOD_END = '2026-09-30'
const W = {}
const fullName = (u) => `${u.first} ${u.last}`
const label = (a) => `${a.number} · ${a.name}`
// Statement row for one account, found by its ledger link
const row = (page, account) => page.locator('.statement-table tbody tr', { has: page.getByRole('link', { name: account.name, exact: true }) })

async function expectRedAndFocused(locator) {
  await expect(locator).toHaveAttribute('aria-invalid', 'true')
  await expect(locator).toBeFocused()
  await expect(locator).toHaveCSS('border-top-color', ERROR_RED)
  await expect(locator).toBeInViewport()
}

// The statement the page is showing, straight from the API (same type and date as the page)
async function statementJson(page, type, date = PERIOD_END) {
  return page.evaluate(async ([t, d]) => {
    const { token } = JSON.parse(localStorage.getItem('limitless.session'))
    return (await fetch(`/api/statements/${t}?date=${d}`, { headers: { Authorization: `Bearer ${token}` } })).json()
  }, [type, date])
}

// Debit and credit totals are shown, and the warning appears exactly when they differ
async function expectBalanceWarningMatchesTotals(page) {
  const tb = await statementJson(page, 'trial-balance')
  const totals = page.locator('.statement-table tfoot td')
  const money = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
  await expect(totals.nth(1)).toHaveText(money(tb.totals.total_debits))
  await expect(totals.nth(2)).toHaveText(money(tb.totals.total_credits))
  expect(tb.balanced).toBe(Number(tb.totals.total_debits) === Number(tb.totals.total_credits))
  await expect(page.getByText('This trial balance does not balance')).toHaveCount(tb.balanced ? 0 : 1)
}

async function openStatement(page, type, { date, from, to } = {}) {
  await page.goto('/reports/statements')
  await page.getByLabel('Statement', { exact: true }).selectOption({ label: type })
  if (from) {
    await page.getByLabel('Period').selectOption('range')
    await page.getByLabel('From date').fill(from)
    await page.getByLabel('To date').fill(to)
  } else {
    await page.getByLabel('As of date').fill(date ?? PERIOD_END)
  }
  await expect(page.locator('.statement-title')).toBeVisible()
}

test.beforeAll(async ({ request }) => {
  const user = async (first, role) => {
    const person = uniquePerson(first)
    const created = await createUser(request, person, role)
    const login = await request.post('/api/auth/login', { data: { username: created.username, password: created.password } })
    const session = await login.json()
    return { ...person, ...created, session, token: session.token }
  }
  W.manager = await user('Morgan', 'MANAGER')
  W.manager2 = await user('Riley', 'MANAGER')
  W.accountant = await user('Avery', 'ACCOUNTANT')
  W.accountant2 = await user('Jordan', 'ACCOUNTANT')
  W.adminToken = await adminToken(request)

  W.tag = `S${Date.now().toString(36)}`
  const account = async (name, prefix, fields) => {
    const a = uniqueAccount(name, prefix)
    return createAccount(request, { ...a, name: `${name} ${W.tag}` }, fields)
  }
  const income = (category, normal_side) => ({ category, subcategory: category, normal_side, statement: 'INCOME_STATEMENT' })
  // The starting cash is matched by owner's capital, so this run's books balance on their own
  W.cash = await account('Cash', '1', { initial_balance: '1000' })
  W.capital = await account("Owner's Capital", '3', { category: 'Equity', subcategory: "Owner's Equity", normal_side: 'RIGHT', initial_balance: '1000' })
  W.payable = await account('Rent Payable', '2', { category: 'Liability', subcategory: 'Current Liabilities', normal_side: 'RIGHT' })
  W.revenue = await account('Service Revenue', '4', income('Revenue', 'RIGHT'))
  W.rent = await account('Rent Expense', '5', income('Expense', 'LEFT'))

  // September: two regular entries and one adjusting entry are approved; one is left pending and one rejected,
  // so the statements must ignore 999 and 777.
  const { accountant: A, manager: M } = W
  const approve = async (id) => expect((await api(request, M.token, 'PUT', `/journal-entries/${id}/approve`)).status).toBe(200)
  W.e1 = await submitEntry(request, A, { date: '2026-09-05', description: 'Consulting revenue', lines: [[W.cash, 'DEBIT', 800], [W.revenue, 'CREDIT', 800]] })
  W.e2 = await submitEntry(request, A, { date: '2026-09-10', lines: [[W.rent, 'DEBIT', 300], [W.cash, 'CREDIT', 300]] })
  W.adj = await submitEntry(request, A, { date: PERIOD_END, type: 'ADJUSTING', description: 'Accrued rent', lines: [[W.rent, 'DEBIT', 50], [W.payable, 'CREDIT', 50]] })
  W.pending = await submitEntry(request, A, { date: '2026-09-15', lines: [[W.cash, 'DEBIT', 999], [W.revenue, 'CREDIT', 999]] })
  W.rejected = await submitEntry(request, A, { date: '2026-09-16', type: 'ADJUSTING', lines: [[W.cash, 'DEBIT', 777], [W.revenue, 'CREDIT', 777]] })
  W.pendingAdj = await submitEntry(request, A, { date: '2026-09-29', type: 'ADJUSTING', description: 'Accrued rent, second half', lines: [[W.rent, 'DEBIT', 25], [W.payable, 'CREDIT', 25]] })
  for (const id of [W.e1, W.e2, W.adj]) await approve(id)
  expect((await api(request, M.token, 'PUT', `/journal-entries/${W.rejected}/reject`, { comment: 'Wrong period.' })).status).toBe(200)
})

// ---------------------------------------------------------------------------------------------------------------
test.describe('Financial statements', () => {
  test('TC-FS-01 (P): manager generates a trial balance as of a date; debits equal credits', async ({ page }) => {
    await as(page, W.manager)
    await page.goto('/reports')
    await page.locator('.report-card', { hasText: 'FINANCIAL STATEMENTS' }).getByRole('link', { name: 'View Report →' }).click()
    await expect(page).toHaveURL(/\/reports\/statements$/)
    await page.getByLabel('As of date').fill(PERIOD_END)
    await expect(row(page, W.cash)).toContainText('$1,500.00')
    await expect(row(page, W.revenue)).toContainText('$800.00')
    await expect(row(page, W.rent)).toContainText('$350.00')
    await expect(row(page, W.payable)).toContainText('$50.00')
    await expect(row(page, W.capital)).toContainText('$1,000.00')
    await expectBalanceWarningMatchesTotals(page)
    await evidence(page, 'TC-FS-01')
  })

  test('TC-FS-02 (P): income statement for a date range shows revenue, expenses and net income', async ({ page }) => {
    await as(page, W.manager)
    await openStatement(page, 'Income Statement', { from: '2026-09-01', to: PERIOD_END })
    await expect(page.locator('.statement-title__period')).toHaveText('Sep. 1, 2026 to Sep. 30, 2026')
    await expect(row(page, W.revenue)).toContainText('$800.00')
    await expect(row(page, W.rent)).toContainText('$350.00')
    await expect(page.locator('.statement-table tfoot')).toContainText('Net Income')
    await evidence(page, 'TC-FS-02')
  })

  test('TC-FS-03 (P): balance sheet groups assets, liabilities and equity and balances', async ({ page }) => {
    await as(page, W.manager)
    await openStatement(page, 'Balance Sheet')
    await expect(page.locator('.statement-table__section')).toContainText(['Assets', 'Liabilities', "Stockholders' Equity"])
    await expect(row(page, W.cash)).toContainText('$1,500.00')
    await expect(row(page, W.payable)).toContainText('$50.00')
    await expect(page.locator('.statement-table tfoot')).toContainText("Total Liabilities & Stockholders' Equity")
    await expect(page.locator('.alert--error')).toHaveCount((await statementJson(page, 'balance-sheet')).balanced ? 0 : 1)
    await evidence(page, 'TC-FS-03')
  })

  test('TC-FS-04 (P): retained earnings statement for the period', async ({ page }) => {
    await as(page, W.manager)
    await openStatement(page, 'Retained Earnings Statement', { from: '2026-09-01', to: PERIOD_END })
    await expect(page.locator('.statement-table')).toContainText(/Net income/i)
    await expect(page.locator('.statement-table')).toContainText(/Retained earnings/i)
    await evidence(page, 'TC-FS-04')
  })

  test('TC-FS-05 (N): pending and rejected entries are left out of every statement', async ({ page, request }) => {
    // With the pending 999 and rejected 777 counted, cash would be 3,276 and revenue 2,576
    const amountFor = async (type, account) => {
      const { body } = await api(request, W.manager.token, 'GET', `/statements/${type}?from=2026-09-01&to=${PERIOD_END}`)
      const r = body.sections.flatMap((s) => s.rows).find((x) => x.account_id === account.id)
      return Number(r.debit ?? r.credit ?? r.amount)
    }
    expect(await amountFor('trial-balance', W.cash)).toBe(1500)
    expect(await amountFor('trial-balance', W.revenue)).toBe(800)
    expect(await amountFor('income-statement', W.revenue)).toBe(800)
    expect(await amountFor('balance-sheet', W.cash)).toBe(1500)
    await as(page, W.manager)
    await openStatement(page, 'Trial Balance')
    await expect(row(page, W.cash)).toContainText('$1,500.00')
    await expect(row(page, W.revenue)).toContainText('$800.00')
    await evidence(page, 'TC-FS-05')
  })

  test('TC-FS-06 (P): clicking an account on a statement opens its ledger', async ({ page }) => {
    await as(page, W.manager)
    await openStatement(page, 'Trial Balance')
    await row(page, W.cash).getByRole('link', { name: W.cash.name }).click()
    await expect(page).toHaveURL(new RegExp(`/accounts/${W.cash.id}/ledger$`))
    await expect(page.getByText('Consulting revenue')).toBeVisible()
    await evidence(page, 'TC-FS-06')
  })

  test('TC-FS-07 (P): a saved statement is listed and reopens with ledger links', async ({ page }) => {
    await as(page, W.manager)
    await openStatement(page, 'Balance Sheet')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.locator('.alert--success')).toHaveText('Balance Sheet saved.')
    const saved = page.locator('tbody tr', { hasText: 'As of Sep. 30, 2026' }).first()
    await expect(saved).toContainText('Balance Sheet')
    await expect(saved).toContainText(fullName(W.manager))
    const popupPromise = page.waitForEvent('popup')
    await saved.getByRole('button', { name: 'View →' }).click()
    const popup = await popupPromise
    await expect(popup.locator('h2')).toHaveText('Balance Sheet')
    await expect(popup.locator(`a[href="/accounts/${W.cash.id}/ledger"]`)).toContainText(W.cash.name)
    await popup.setViewportSize({ width: 1440, height: 900 })
    await evidence(popup, 'TC-FS-07')
  })

  test('TC-FS-08 (P): manager emails a statement to a user', async ({ page }) => {
    await as(page, W.manager)
    await openStatement(page, 'Income Statement', { from: '2026-09-01', to: PERIOD_END })
    await page.getByLabel('Email recipient').selectOption({ label: `${fullName(W.accountant)} (Accountant)` })
    await page.getByLabel('Optional note shown above the statement').fill('September results attached.')
    await page.getByRole('button', { name: 'Email', exact: true }).click()
    await expect(page.locator('.alert--success')).toContainText('sent')
    await evidence(page, 'TC-FS-08')
  })

  test('TC-FS-09 (N): emailing a statement without a recipient is refused and the field is highlighted', async ({ page }) => {
    await as(page, W.manager)
    await openStatement(page, 'Trial Balance')
    await page.getByRole('button', { name: 'Email', exact: true }).click()
    await expect(page.locator('.alert--error', { hasText: 'Choose who' })).toHaveText('Choose who to email the statement to.')
    await expectRedAndFocused(page.getByLabel('Email recipient'))
    await evidence(page, 'TC-FS-09')
  })

  test('TC-FS-10 (N): a from date after the to date is rejected', async ({ page }) => {
    await as(page, W.manager)
    await page.goto('/reports/statements')
    await page.getByLabel('Period').selectOption('range')
    await page.getByLabel('From date').fill('2026-10-31')
    await page.getByLabel('To date').fill('2026-10-01')
    await expect(page.locator('.alert--error')).toHaveText('The from date must be on or before the to date.')
    await expect(page.locator('.alert--error')).toBeInViewport()
    await evidence(page, 'TC-FS-10')
  })

  test('TC-FS-11 (N): accountants cannot open financial statements', async ({ page, request }) => {
    expect((await api(request, W.accountant.token, 'GET', '/statements/trial-balance?date=2026-09-30')).status).toBe(403)
    await as(page, W.accountant)
    await page.goto('/reports')
    await expect(page.getByText('Financial statements', { exact: true })).toHaveCount(0)
    await page.goto('/reports/statements')
    await expect(page).not.toHaveURL(/\/reports\/statements$/)
    await evidence(page, 'TC-FS-11')
  })

  test('TC-FS-12 (P): the statement page prints without the toolbar and email form', async ({ page }) => {
    await page.addInitScript(() => { window.print = () => { window.__printed = true } })
    await as(page, W.manager)
    await openStatement(page, 'Trial Balance')
    await page.getByRole('button', { name: 'Print' }).click()
    expect(await page.evaluate(() => window.__printed)).toBe(true)
    await page.emulateMedia({ media: 'print' })
    await expect(page.locator('form.toolbar.no-print')).toBeHidden()
    await expect(page.locator('.statement-table')).toBeVisible()
    await evidence(page, 'TC-FS-12')
  })

  test('TC-FS-13 (N): books that do not balance get a warning on the trial balance', async ({ page, request }) => {
    // A starting balance with nothing on the other side puts the books out of balance
    const a = uniqueAccount('Suspense', '1')
    await createAccount(request, { ...a, name: `Suspense ${W.tag}` }, { initial_balance: '123.45' })
    await as(page, W.manager)
    await openStatement(page, 'Trial Balance')
    await expect(page.locator('.alert--error')).toHaveText('This trial balance does not balance: total debits do not equal total credits.')
    await expectBalanceWarningMatchesTotals(page)
    await evidence(page, 'TC-FS-13')
  })

  test('TC-FS-14 (N): unknown statement type and missing dates are rejected by the API', async ({ request }) => {
    const bad = await api(request, W.manager.token, 'GET', '/statements/cash-flow?date=2026-09-30')
    expect(bad.status).toBe(400)
    expect(bad.body.message).toBe('Statement type must be trial-balance, income-statement, balance-sheet, or retained-earnings.')
    const half = await api(request, W.manager.token, 'GET', '/statements/income-statement?from=2026-09-01')
    expect(half.status).toBe(400)
    expect(half.body.message).toBe('Enter a date, or both a from date and a to date.')
  })
})

// ---------------------------------------------------------------------------------------------------------------
test.describe('Adjusting entries', () => {
  test('TC-ADJ-01 (P): accountant prepares an adjusting entry from the journal form', async ({ page }) => {
    await as(page, W.accountant)
    await page.goto('/journal/new')
    await page.getByLabel('Type', { exact: true }).selectOption('ADJUSTING')
    await page.locator('input[type=date]').first().fill(PERIOD_END)
    await page.getByLabel('Account for debit line 1').selectOption({ label: label(W.rent) })
    await page.getByLabel('Amount for debit line 1').fill('10.00')
    await page.getByLabel('Account for credit line 1').selectOption({ label: label(W.payable) })
    await page.getByLabel('Amount for credit line 1').fill('10.00')
    await page.getByRole('button', { name: 'Submit for Approval' }).click()
    await expect(page).toHaveURL(/\/journal\/\d+$/)
    await expect(page.getByLabel('Type', { exact: true })).toHaveValue('Adjusting')
    W.formAdj = Number(page.url().split('/').pop())
    await evidence(page, 'TC-ADJ-01')
  })

  test('TC-ADJ-02 (P): the journal lists pending adjusting entries only', async ({ page }) => {
    await as(page, W.manager)
    await page.goto('/journal')
    await page.getByLabel('Filter by status').selectOption('SUBMITTED')
    await page.getByLabel('Filter by entry type').selectOption('ADJUSTING')
    await page.getByLabel('Search by account name, amount or date').fill(W.tag)
    const rows = page.locator('tbody tr')
    await expect(rows).toHaveCount(2)
    for (const id of [W.pendingAdj, W.formAdj]) await expect(page.getByRole('link', { name: `JE-${id}` })).toBeVisible()
    await expect(page.locator('tbody')).not.toContainText('Regular')
    await evidence(page, 'TC-ADJ-02')
  })

  test('TC-ADJ-03 (P): adjusting entries can be listed by approved and by rejected status', async ({ page }) => {
    await as(page, W.manager)
    await page.goto(`/journal?status=APPROVED&type=ADJUSTING`)
    await page.getByLabel('Search by account name, amount or date').fill(W.tag)
    await expect(page.locator('tbody tr')).toHaveCount(1)
    await expect(page.getByRole('link', { name: `JE-${W.adj}` })).toBeVisible()
    await page.getByLabel('Filter by status').selectOption('REJECTED')
    await expect(page.locator('tbody tr')).toHaveCount(1)
    await expect(page.getByRole('link', { name: `JE-${W.rejected}` })).toBeVisible()
    await evidence(page, 'TC-ADJ-03')
  })

  test('TC-ADJ-04 (N): regular entries never appear under the Adjusting filter', async ({ page }) => {
    await as(page, W.manager)
    await page.goto('/journal?type=ADJUSTING')
    await page.getByLabel('Search by account name, amount or date').fill(W.tag)
    await expect(page.locator('tbody tr').first()).toBeVisible()
    for (const id of [W.e1, W.e2, W.pending]) await expect(page.getByRole('link', { name: `JE-${id}` })).toHaveCount(0)
    await evidence(page, 'TC-ADJ-04')
  })

  test('TC-ADJ-05 (P): manager home counts pending adjusting entries and links to them', async ({ page, request }) => {
    const { body } = await api(request, W.manager.token, 'GET', '/journal-entries/pending-count?type=ADJUSTING')
    await as(page, W.manager)
    await page.goto('/home')
    const count = body?.count
    await expect(page.locator('.app__main')).toContainText(count === 1 ? '1 of them is an adjusting entry' : `${count} of them are adjusting entries`)
    await page.getByRole('link', { name: 'Review pending adjusting entries →' }).click()
    await expect(page).toHaveURL(/\/journal\?status=SUBMITTED&type=ADJUSTING$/)
    await expect(page.getByLabel('Filter by entry type')).toHaveValue('ADJUSTING')
    await evidence(page, 'TC-ADJ-05')
  })

  test('TC-ADJ-06 (P): an approved adjusting entry posts to the ledger and the statements', async ({ page }) => {
    await as(page, W.manager)
    await page.goto(`/accounts/${W.payable.id}/ledger`)
    await expect(page.getByText('Accrued rent', { exact: true })).toBeVisible()
    await expect(page.locator('tbody tr', { hasText: 'Accrued rent' })).toContainText('$50.00')
    await evidence(page, 'TC-ADJ-06')
  })

  test('TC-ADJ-07 (N): an unknown entry type is rejected', async ({ request }) => {
    const res = await api(request, W.accountant.token, 'POST', '/journal-entries/validate', {
      entry_date: PERIOD_END, entry_type: 'BOGUS', lines: [{ account_id: W.rent.id, side: 'DEBIT', amount: 5 }, { account_id: W.cash.id, side: 'CREDIT', amount: 5 }],
    })
    expect(res.body.errors.map((e) => e.message)).toContain('Entry type must be REGULAR, ADJUSTING, CLOSING, or REVERSING.')
  })
})

// ---------------------------------------------------------------------------------------------------------------
test.describe('Adjusting entries: approval, notification, status and filters', () => {
  test('TC-ADJ-08 (N): rejecting an adjusting entry needs a reason; with one, it is rejected and the reason kept', async ({ page, request }) => {
    const id = await submitEntry(request, W.accountant, { date: '2026-08-31', type: 'ADJUSTING', description: 'Depreciation', lines: [[W.rent, 'DEBIT', 15], [W.payable, 'CREDIT', 15]] })
    const blank = await api(request, W.manager.token, 'PUT', `/journal-entries/${id}/reject`, { comment: ' ' })
    expect(blank.status).toBe(400)
    expect(blank.body.message).toBe('A reason is required when rejecting a journal entry.')
    await as(page, W.manager)
    await page.goto(`/journal/${id}`)
    await page.getByRole('button', { name: 'Reject' }).click()
    await expect(page.getByRole('button', { name: 'Confirm Rejection' })).toBeDisabled()
    await page.getByLabel(/Reason for rejection/i).fill('Use the depreciation account, not rent.')
    await page.getByRole('button', { name: 'Confirm Rejection' }).click()
    await expect(page.locator('.alert--success')).toHaveText('Entry rejected.')
    await expect(page.getByLabel('Comment', { exact: true })).toHaveValue('Use the depreciation account, not rent.')
    await expect(page.getByLabel('Type', { exact: true })).toHaveValue('Adjusting')
    await evidence(page, 'TC-ADJ-08')
  })

  test('TC-ADJ-09 (P): managers are notified when an adjusting entry is submitted for approval', async ({ page, request }) => {
    const before = (await api(request, W.manager.token, 'GET', '/journal-entries/pending-count?type=ADJUSTING')).body.count
    const id = await submitEntry(request, W.accountant, { date: '2026-08-15', type: 'ADJUSTING', description: 'Prepaid insurance used', lines: [[W.rent, 'DEBIT', 20], [W.payable, 'CREDIT', 20]] })
    expect((await api(request, W.manager.token, 'GET', '/journal-entries/pending-count?type=ADJUSTING')).body.count).toBe(before + 1)
    // Email to every manager (logged by the backend when no email API key is set)
    if (process.env.E2E_BACKEND_LOG) {
      await expect.poll(() => readFileSync(process.env.E2E_BACKEND_LOG, 'utf8')).toContain(`Adjusting journal entry #${id} needs your approval`)
    }
    await as(page, W.manager)
    await page.goto('/home')
    await expect(page.locator('.app__main')).toContainText(`${before + 1} of them ${before + 1 === 1 ? 'is an adjusting entry' : 'are adjusting entries'}`)
    await evidence(page, 'TC-ADJ-09')
  })

  test('TC-ADJ-10 (P/N): pending adjusting entries can be filtered by date', async ({ page }) => {
    await as(page, W.manager)
    await page.goto('/journal?status=SUBMITTED&type=ADJUSTING')
    await page.getByLabel('Search by account name, amount or date').fill(W.tag)
    await page.getByLabel('From date').fill('2026-09-01')
    await page.getByLabel('To date').fill('2026-09-30')
    for (const id of [W.pendingAdj, W.formAdj]) await expect(page.getByRole('link', { name: `JE-${id}` })).toBeVisible()
    await expect(page.locator('tbody')).not.toContainText('Aug.')
    await evidence(page, 'TC-ADJ-10')
    await page.getByLabel('From date').fill('2026-10-01')
    await page.getByLabel('To date').fill('2026-10-31')
    await expect(page.locator('.data-table__empty')).toBeVisible()
  })

  test('TC-ADJ-11 (P/N): an adjusting entry can be reset or cancelled before submitting, but not deleted after', async ({ page, request }) => {
    await as(page, W.accountant)
    await page.goto('/journal/new')
    await page.getByLabel('Type', { exact: true }).selectOption('ADJUSTING')
    await page.getByLabel('Account for debit line 1').selectOption({ label: label(W.rent) })
    await page.getByLabel('Amount for debit line 1').fill('5.00')
    await page.getByRole('button', { name: 'Reset' }).click()
    await expect(page.getByLabel('Type', { exact: true })).toHaveValue('REGULAR')
    await expect(page.getByLabel('Account for debit line 1')).toHaveValue('')
    await page.getByLabel('Type', { exact: true }).selectOption('ADJUSTING')
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page).toHaveURL(/\/journal$/)
    // Once submitted it stays: no delete button, and the server refuses
    await page.goto(`/journal/${W.formAdj}`)
    for (const name of ['Delete', 'Edit', 'Cancel']) await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
    expect((await api(request, W.accountant.token, 'DELETE', `/journal-entries/${W.formAdj}`)).status).toBe(409)
    await evidence(page, 'TC-ADJ-11')
  })

  test('TC-ADJ-12 (P): an accountant sees the status of adjusting entries prepared by others', async ({ page }) => {
    await as(page, W.accountant2)
    await page.goto('/journal?type=ADJUSTING')
    await page.getByLabel('Search by account name, amount or date').fill(W.tag)
    const row = (id) => page.locator('tbody tr', { has: page.getByRole('link', { name: `JE-${id}`, exact: true }) })
    await expect(row(W.pendingAdj)).toContainText('Pending')
    await expect(row(W.adj)).toContainText('Approved')
    await expect(row(W.rejected)).toContainText('Rejected')
    await evidence(page, 'TC-ADJ-12')
  })

  test('TC-ADJ-13 (N): an unbalanced adjusting entry shows a red error and cannot be submitted until fixed', async ({ page }) => {
    await as(page, W.accountant)
    await page.goto('/journal/new')
    await page.getByLabel('Type', { exact: true }).selectOption('ADJUSTING')
    await page.getByLabel('Account for debit line 1').selectOption({ label: label(W.rent) })
    await page.getByLabel('Amount for debit line 1').fill('30.00')
    await page.getByLabel('Account for credit line 1').selectOption({ label: label(W.payable) })
    await page.getByLabel('Amount for credit line 1').fill('25.00')
    await page.getByRole('button', { name: 'Submit for Approval' }).click()
    const problems = page.locator('.form-feedback .alert')
    await expect(problems).toContainText('Total debits (30.00) must equal total credits (25.00). The difference is 5.00.')
    await expect(problems).toHaveCSS('color', ERROR_RED)
    await expect(page.getByRole('button', { name: 'Submit for Approval' })).toBeDisabled()
    await evidence(page, 'TC-ADJ-13')
    await page.getByLabel('Amount for credit line 1').fill('30.00')
    await expect(problems).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Submit for Approval' })).toBeEnabled()
  })
})

// ---------------------------------------------------------------------------------------------------------------
test.describe('Reports link to ledgers', () => {
  test('TC-LNK-01 (P): Chart of Accounts report links each account to its ledger', async ({ page }) => {
    await as(page, W.accountant)
    await page.goto('/reports/accounts')
    await page.getByRole('link', { name: W.revenue.name, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/accounts/${W.revenue.id}/ledger$`))
    await evidence(page, 'TC-LNK-01')
  })

  test('TC-LNK-02 (P): Journal Entries report links each account to its ledger', async ({ page }) => {
    await as(page, W.accountant)
    await page.goto('/reports/journal')
    await page.locator('tbody tr', { hasText: `JE-${W.e2}` }).getByRole('link', { name: W.rent.name }).click()
    await expect(page).toHaveURL(new RegExp(`/accounts/${W.rent.id}/ledger$`))
    await evidence(page, 'TC-LNK-02')
  })

  test('TC-LNK-03 (P): Event Log report links accounts to ledgers and entries to the journal', async ({ page }) => {
    await as(page, W.manager)
    await page.goto('/reports/event-log')
    await page.getByRole('link', { name: `Account #${W.cash.id}`, exact: true }).first().click()
    await expect(page).toHaveURL(new RegExp(`/accounts/${W.cash.id}/ledger$`))
    await page.goBack()
    await page.getByRole('link', { name: `Journal entry #${W.e1}`, exact: true }).first().click()
    await expect(page).toHaveURL(new RegExp(`/journal/${W.e1}$`))
    await evidence(page, 'TC-LNK-03')
  })

  test('TC-LNK-04 (N): computed statement lines such as Net Income are not links', async ({ page }) => {
    await as(page, W.manager)
    await openStatement(page, 'Income Statement', { from: '2026-09-01', to: PERIOD_END })
    await expect(page.locator('.statement-table tfoot a')).toHaveCount(0)
    await expect(page.locator('.statement-table__total a')).toHaveCount(0)
    await evidence(page, 'TC-LNK-04')
  })
})

test.describe('Chart of accounts and ledger: account numbers and post references', () => {
  test('TC-LNK-06 (P): clicking an account number on the chart of accounts opens its ledger', async ({ page }) => {
    await as(page, W.accountant)
    await page.goto('/accounts')
    await page.getByLabel('Search by account name or number').fill(String(W.cash.number))
    await page.getByRole('link', { name: String(W.cash.number), exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/accounts/${W.cash.id}/ledger$`))
    await evidence(page, 'TC-LNK-06')
  })

  test('TC-LNK-07 (P): the post reference (PR) on an adjusting posting opens that adjusting entry', async ({ page }) => {
    await as(page, W.manager)
    await page.goto(`/accounts/${W.payable.id}/ledger`)
    const row = page.locator('tbody tr', { hasText: 'Accrued rent' })
    await expect(row).toContainText(`JE-${W.adj}`)
    await row.getByRole('link', { name: `JE-${W.adj}` }).click()
    await expect(page).toHaveURL(new RegExp(`/journal/${W.adj}$`))
    await expect(page.getByLabel('Type', { exact: true })).toHaveValue('Adjusting')
    await evidence(page, 'TC-LNK-07')
  })

  test('TC-LNK-08 (P/N): the ledger searches by account name or amount and filters by date, with an accurate balance', async ({ page }) => {
    await as(page, W.manager)
    await page.goto(`/accounts/${W.cash.id}/ledger`)
    const rows = page.locator('tbody tr')
    // Opening balance 1,000 → +800 → −300
    await expect(rows.filter({ hasText: 'Consulting revenue' })).toContainText('$1,800.00')
    await expect(rows.last()).toContainText('$1,500.00')
    const search = page.getByLabel('Search by account name, amount, description or post reference')
    await search.fill('Service Revenue')
    await expect(rows.filter({ hasText: `JE-${W.e1}` })).toBeVisible()
    await expect(rows.filter({ hasText: `JE-${W.e2}` })).toHaveCount(0)
    await search.fill('300')
    await expect(rows.filter({ hasText: `JE-${W.e2}` })).toBeVisible()
    await expect(rows.filter({ hasText: `JE-${W.e1}` })).toHaveCount(0)
    await search.fill('')
    await page.getByLabel('From date').fill('2026-09-08')
    await page.getByLabel('To date').fill('2026-09-30')
    await expect(rows.filter({ hasText: `JE-${W.e2}` })).toBeVisible()
    await expect(rows.filter({ hasText: `JE-${W.e1}` })).toHaveCount(0)
    await evidence(page, 'TC-LNK-08')
    await search.fill('No such account')
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('Opening balance')
  })
})

// ---------------------------------------------------------------------------------------------------------------
test.describe('Errors: red fields and cursor on the first one', () => {
  test('TC-ERR-01 (N): sign-in with blank fields highlights both and puts the cursor in Username', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Sign In' }).click()
    const username = page.getByLabel('Username', { exact: true })
    await expect(username).toBeFocused()
    await expect(username).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('aria-invalid', 'true')
    await expect(page.locator('.auth-field__control').first()).toHaveCSS('border-bottom-color', AUTH_ERROR_RED)
    await evidence(page, 'TC-ERR-01')
  })

  test('TC-ERR-02 (N): Create User with nothing filled marks every required field; cursor in First Name', async ({ page, request }) => {
    await page.addInitScript((value) => localStorage.setItem('limitless.session', value), JSON.stringify(await adminSession(request)))
    await page.goto('/admin/users/new')
    await page.getByRole('button', { name: 'Create User' }).click()
    await expect(page.locator('.alert--error')).toHaveText('First name, last name, email address, and role are required.')
    await expectRedAndFocused(page.getByLabel('FIRST NAME'))
    for (const name of ['LAST NAME', 'EMAIL ADDRESS', 'ROLE']) await expect(page.getByLabel(name)).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByLabel('Address', { exact: true })).not.toHaveAttribute('aria-invalid', 'true')
    await evidence(page, 'TC-ERR-02')
  })

  test('TC-ERR-03 (N): a second submit with the same error moves the cursor back to the field', async ({ page, request }) => {
    await page.addInitScript((value) => localStorage.setItem('limitless.session', value), JSON.stringify(await adminSession(request)))
    await page.goto('/admin/users/new')
    await page.getByLabel('FIRST NAME').fill('Pat')
    await page.getByRole('button', { name: 'Create User' }).click()
    await expectRedAndFocused(page.getByLabel('LAST NAME'))
    await page.getByLabel('Address', { exact: true }).focus()
    await page.getByRole('button', { name: 'Create User' }).click()
    await expect(page.getByLabel('LAST NAME')).toBeFocused()
    await expect(page.getByLabel('FIRST NAME')).not.toHaveAttribute('aria-invalid', 'true')
    await evidence(page, 'TC-ERR-03')
  })

  test('TC-ERR-04 (N): journal entry errors highlight the exact line field; fixing it clears the red', async ({ page }) => {
    await as(page, W.accountant)
    await page.goto('/journal/new')
    await page.getByLabel('Account for debit line 1').selectOption({ label: label(W.rent) })
    await page.getByLabel('Amount for debit line 1').fill('40.00')
    await page.getByLabel('Amount for credit line 1').fill('40.00')
    await page.getByRole('button', { name: 'Submit for Approval' }).click()
    await expect(page.locator('.form-feedback .alert')).toContainText('Line 2: select an account.')
    const credit = page.getByLabel('Account for credit line 1')
    await expectRedAndFocused(credit)
    await expect(page.getByLabel('Account for debit line 1')).not.toHaveAttribute('aria-invalid', 'true')
    await evidence(page, 'TC-ERR-04')
    await credit.selectOption({ label: label(W.cash) })
    await expect(credit).not.toHaveAttribute('aria-invalid', 'true')
  })

  test('TC-ERR-05 (N): Add Account with a number that does not match the category highlights the number and focuses it', async ({ page, request }) => {
    await page.addInitScript((value) => localStorage.setItem('limitless.session', value), JSON.stringify(await adminSession(request)))
    await page.goto('/accounts/new')
    await page.getByLabel('ACCOUNT NAME').fill(`Petty Cash ${W.tag}`)
    await page.getByLabel('Category *', { exact: true }).selectOption('Asset')
    await page.getByLabel('ACCOUNT NUMBER').fill('2001')
    await page.getByLabel('ACCOUNT NUMBER').press('Enter')
    await expect(page.getByText('Asset account numbers must start with 1.')).toBeVisible()
    await expectRedAndFocused(page.getByLabel('ACCOUNT NUMBER'))
    await expect(page.getByLabel('Category *', { exact: true })).not.toHaveAttribute('aria-invalid', 'true')
    await evidence(page, 'TC-ERR-05')
  })

  test('TC-ERR-06 (N): suspension expiry before the start date highlights the expiry date', async ({ page, request }) => {
    const person = uniquePerson('Sky')
    const user = await createUser(request, person)
    await page.addInitScript((value) => localStorage.setItem('limitless.session', value), JSON.stringify(await adminSession(request)))
    await page.goto(`/admin/users/${user.id}`)
    await page.getByLabel('START DATE').fill('2026-12-10')
    await page.getByLabel('EXPIRY DATE').fill('2026-12-01')
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect(page.locator('.alert--error')).toHaveText('Suspension expiry date must be after the start date.')
    await expectRedAndFocused(page.getByLabel('EXPIRY DATE'))
    await expect(page.getByLabel('START DATE')).not.toHaveAttribute('aria-invalid', 'true')
    await evidence(page, 'TC-ERR-06')
  })

  test('TC-ERR-07 (N): Request Access scrolls to and focuses the missing security answer', async ({ page }) => {
    await page.goto('/request-access')
    const person = uniquePerson('Quinn')
    await page.getByLabel('First name').fill(person.first)
    await page.getByLabel('Last name').fill(person.last)
    await page.getByLabel('Email address').fill(person.email)
    await page.getByLabel('Address', { exact: true }).fill('1 Test Street')
    await page.getByLabel('Date of birth').fill('2000-01-01')
    await page.getByLabel('Security question 1').fill('lincoln')
    await page.getByLabel('Security question 2').fill('atlanta')
    await page.getByRole('button', { name: 'Submit Request' }).click()
    const third = page.getByLabel('Security question 3')
    await expect(third).toBeFocused()
    await expect(third).toHaveAttribute('aria-invalid', 'true')
    await expect(third).toBeInViewport()
    await expect(page.getByLabel('Security question 1')).not.toHaveAttribute('aria-invalid', 'true')
    await evidence(page, 'TC-ERR-07')
  })

  test('TC-ERR-08 (N): a server error with no field (duplicate email) is centered on screen', async ({ page, request }) => {
    const taken = uniquePerson('Dup')
    await createUser(request, taken)
    await page.addInitScript((value) => localStorage.setItem('limitless.session', value), JSON.stringify(await adminSession(request)))
    await page.goto('/admin/users/new')
    await page.getByLabel('FIRST NAME').fill('Dana')
    await page.getByLabel('LAST NAME').fill('Duplicate')
    await page.getByLabel('EMAIL ADDRESS').fill(taken.email)
    await page.getByLabel('ROLE').selectOption('ACCOUNTANT')
    await page.getByRole('button', { name: 'Create User' }).click()
    await expect(page.locator('.alert--error')).toBeVisible()
    await expect(page.locator('.alert--error')).toBeInViewport()
    await evidence(page, 'TC-ERR-08')
  })
})

// ---------------------------------------------------------------------------------------------------------------
test.describe('Email: any role to any role, with attachments', () => {
  const pick = (page, who, role) => page.getByLabel('RECIPIENT').selectOption({ label: `${fullName(who)} (${role})` })
  const files = (page) => page.getByLabel('ATTACHMENTS (PDF, WORD, EXCEL, CSV, JPG, PNG)')

  test('TC-EML-03 (P): an accountant can email another accountant', async ({ page }) => {
    await as(page, W.accountant)
    await page.goto('/email')
    await pick(page, W.accountant2, 'Accountant')
    await page.getByLabel('SUBJECT').fill('Month-end close')
    await page.getByLabel('MESSAGE').fill('Can you check the September accruals?')
    await page.getByRole('button', { name: 'Send Email' }).click()
    await expect(page.locator('.alert--success')).toHaveText(`Email sent to ${fullName(W.accountant2)}.`)
    await evidence(page, 'TC-EML-03')
  })

  test('TC-EML-04 (P): a manager is offered managers, accountants and administrators', async ({ page }) => {
    await as(page, W.manager)
    await page.goto('/email')
    const options = page.getByLabel('RECIPIENT').locator('option')
    await expect(options.filter({ hasText: `${fullName(W.manager2)} (Manager)` })).toHaveCount(1)
    await expect(options.filter({ hasText: `${fullName(W.accountant)} (Accountant)` })).toHaveCount(1)
    await expect(options.filter({ hasText: '(Administrator)' }).first()).toBeAttached()
    await expect(options.filter({ hasText: fullName(W.manager) })).toHaveCount(0)
    await pick(page, W.manager2, 'Manager')
    await evidence(page, 'TC-EML-04')
  })

  test('TC-EML-05 (P): an email goes out with two attachments', async ({ page }) => {
    await as(page, W.manager)
    await page.goto('/email')
    await pick(page, W.accountant, 'Accountant')
    await page.getByLabel('SUBJECT').fill('Statements for review')
    await page.getByLabel('MESSAGE').fill('Both files are attached.')
    await files(page).setInputFiles([
      { name: 'trial-balance.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') },
      { name: 'accruals.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('xlsx') },
    ])
    await expect(page.locator('.journal-files li')).toHaveCount(2)
    await page.getByRole('button', { name: 'Send Email' }).click()
    await expect(page.locator('.alert--success')).toHaveText(`Email sent to ${fullName(W.accountant)}.`)
    // With no email API key the backend logs each email; E2E_BACKEND_LOG points at that log
    if (process.env.E2E_BACKEND_LOG) {
      await expect.poll(() => readFileSync(process.env.E2E_BACKEND_LOG, 'utf8')).toContain('Attachments: trial-balance.pdf, accruals.xlsx')
    }
    await expect(page.locator('.journal-files li')).toHaveCount(0)
    await evidence(page, 'TC-EML-05')
  })

  test('TC-EML-06 (P): an attachment can be removed before sending', async ({ page }) => {
    await as(page, W.accountant)
    await page.goto('/email')
    await files(page).setInputFiles([
      { name: 'keep.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF') },
      { name: 'drop.png', mimeType: 'image/png', buffer: Buffer.from('png') },
    ])
    await page.getByRole('button', { name: 'Remove drop.png' }).click()
    await expect(page.locator('.journal-files li')).toHaveText(['keep.pdf Remove'])
    await evidence(page, 'TC-EML-06')
  })

  test('TC-EML-07 (N): a file type that is not allowed is refused and the picker is highlighted', async ({ page }) => {
    await as(page, W.accountant)
    await page.goto('/email')
    await pick(page, W.manager, 'Manager')
    await page.getByLabel('SUBJECT').fill('Wrong file')
    await page.getByLabel('MESSAGE').fill('See attached.')
    await files(page).setInputFiles({ name: 'setup.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('MZ') })
    await page.getByRole('button', { name: 'Send Email' }).click()
    await expect(page.locator('.alert--error')).toHaveText('Attachments must be PDF, Word, Excel, CSV, JPG, or PNG files.')
    await expect(files(page)).toHaveAttribute('aria-invalid', 'true')
    await expect(files(page)).toBeFocused()
    await evidence(page, 'TC-EML-07')
  })

  test('TC-EML-08 (N): attachments over 10 MB in total are refused before sending', async ({ page }) => {
    await as(page, W.accountant)
    const calls = []
    page.on('request', (r) => r.url().endsWith('/api/email') && calls.push(r.method()))
    await page.goto('/email')
    await pick(page, W.manager, 'Manager')
    await page.getByLabel('SUBJECT').fill('Big file')
    await page.getByLabel('MESSAGE').fill('Too large.')
    await files(page).setInputFiles({ name: 'scan.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(11 * 1024 * 1024, 1) })
    await page.getByRole('button', { name: 'Send Email' }).click()
    await expect(page.locator('.alert--error')).toHaveText('Attachments can add up to at most 10 MB.')
    await expect(files(page)).toHaveAttribute('aria-invalid', 'true')
    expect(calls).toEqual([])
    await evidence(page, 'TC-EML-08')
  })

  test('TC-EML-09 (N): missing recipient, subject and message are all highlighted; cursor on Recipient', async ({ page }) => {
    await as(page, W.manager)
    await page.goto('/email')
    await page.getByRole('button', { name: 'Send Email' }).click()
    await expect(page.locator('.alert--error')).toHaveText('Choose a recipient and enter a subject and message.')
    await expectRedAndFocused(page.getByLabel('RECIPIENT'))
    await expect(page.getByLabel('SUBJECT')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByLabel('MESSAGE')).toHaveAttribute('aria-invalid', 'true')
    await evidence(page, 'TC-EML-09')
  })

  test('TC-EML-10 (P): the message box keeps its full width when an error and attachments are shown', async ({ page }) => {
    await as(page, W.manager)
    await page.goto('/email')
    const message = page.getByLabel('MESSAGE')
    const before = (await message.boundingBox()).width
    await files(page).setInputFiles({ name: 'a.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF') })
    await page.getByRole('button', { name: 'Send Email' }).click()
    await expect(page.locator('.alert--error')).toBeVisible()
    expect((await message.boundingBox()).width).toBe(before)
    expect(before).toBeGreaterThan(600)
    expect((await page.getByLabel('SUBJECT').boundingBox()).width).toBeLessThan(before / 1.5)
    await evidence(page, 'TC-EML-10')
  })

  test('TC-EML-11 (N): the API refuses pending and unknown recipients and a missing subject', async ({ request }) => {
    const pendingId = await requestAccess(request, uniquePerson('Pending'))
    const send = (fields) => request.post('/api/email', { headers: { Authorization: `Bearer ${W.accountant.token}` }, multipart: fields })
    const pending = await send({ recipient_user_id: String(pendingId), subject: 'Hi', body: 'Hello' })
    expect(pending.status()).toBe(403)
    expect((await pending.json()).message).toBe('You cannot send email to this user.')
    const unknown = await send({ recipient_user_id: '99999999', subject: 'Hi', body: 'Hello' })
    expect(unknown.status()).toBe(404)
    const noSubject = await send({ recipient_user_id: String(W.manager.id), body: 'Hello' })
    expect(noSubject.status()).toBe(400)
    expect((await noSubject.json()).message).toBe('Recipient, subject, and message are all required.')
  })

  test('TC-EML-12 (N): non-admins cannot email a deactivated user; administrators still can', async ({ request }) => {
    const person = uniquePerson('Former')
    const former = await approvedUser(request, person, 'MANAGER')
    expect((await api(request, W.adminToken, 'PUT', `/users/${former.id}/deactivate`)).status).toBe(200)
    const send = (token) => request.post('/api/email', { headers: { Authorization: `Bearer ${token}` }, multipart: { recipient_user_id: String(former.id), subject: 'Hi', body: 'Hello' } })
    expect((await send(W.accountant.token)).status()).toBe(403)
    expect((await send(W.adminToken)).status()).toBe(200)
  })

  test('TC-EML-13 (P): an administrator emails a user with an attachment', async ({ page, request }) => {
    await page.addInitScript((value) => localStorage.setItem('limitless.session', value), JSON.stringify(await adminSession(request)))
    await page.goto('/admin/email')
    await page.getByLabel('RECIPIENT').selectOption({ label: `${fullName(W.manager)} (${W.manager.username})` })
    await page.getByLabel('SUBJECT').fill('Policy update')
    await page.getByLabel('MESSAGE').fill('Please read the attached policy.')
    await files(page).setInputFiles({ name: 'policy.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF') })
    await page.getByRole('button', { name: 'Send Email' }).click()
    await expect(page.locator('.alert--success')).toHaveText(`Email sent to ${W.manager.email}.`)
    await evidence(page, 'TC-EML-13')
  })
})

// The admin's session the way the login page stores it
async function adminSession(request) {
  const { token, ...user } = await (await request.post('/api/auth/login', { data: ADMIN })).json()
  return { token, user }
}
