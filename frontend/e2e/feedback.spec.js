// Sprint 1 and 2 feedback: calculator, sorting, printable reports, What's New, temporary passwords.
// Runs against the real backend, like the other specs.
import { expect, test } from '@playwright/test'
import { ADMIN, adminToken, createAccount, createUser, evidence, signIn, signInAsAdmin, uniqueAccount, uniquePerson } from './helpers.js'

// Signs in through the API and stores the session the way the login page does.
async function as(page, request, credentials) {
  const { token, ...user } = await (await request.post('/api/auth/login', { data: credentials })).json()
  await page.addInitScript((value) => localStorage.setItem('limitless.session', value), JSON.stringify({ token, user }))
}

test.describe('Calculator', () => {
  test('TC-CALC-01 (P): the calculator opens from any page and works out a sum', async ({ page, request }) => {
    await as(page, request, ADMIN)
    for (const path of ['/accounts', '/journal', '/reports']) {
      await page.goto(path)
      await expect(page.getByRole('button', { name: 'Calculator' })).toBeVisible()
    }
    await page.getByRole('button', { name: 'Calculator' }).click()
    const calculator = page.getByRole('dialog', { name: 'Calculator' })
    await expect(calculator).toBeVisible()
    for (const key of ['1', '2', '5', '0', 'Add', '7', '5', 'Decimal point', '5', 'Equals']) {
      await calculator.getByRole('button', { name: key, exact: true }).click()
    }
    await expect(calculator.locator('.pac-display')).toContainText('1,325.50')
    await evidence(page, 'F01')
    await calculator.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(calculator).toBeHidden()
  })
})

test.describe('Sorting', () => {
  test('TC-SORT-01 (P): clicking a column heading sorts the table, and clicking again reverses it', async ({ page, request }) => {
    const tag = `Sort${Date.now().toString(36)}`
    for (const balance of ['300', '1000', '25']) {
      await createAccount(request, { ...uniqueAccount('Sort'), name: `${tag} ${balance}` }, { initial_balance: balance })
    }
    await as(page, request, ADMIN)
    await page.goto('/accounts')
    await page.getByLabel('Search by account name or number').fill(tag)
    const names = page.locator('tbody tr td:nth-child(2)')
    await expect(names).toHaveCount(3)

    const balance = page.getByRole('columnheader', { name: /BALANCE/ })
    await balance.getByRole('button').click()
    await expect(balance).toHaveAttribute('aria-sort', 'ascending')
    await expect(names).toHaveText([`${tag} 25`, `${tag} 300`, `${tag} 1000`]) // by amount, not as text
    await balance.getByRole('button').click()
    await expect(balance).toHaveAttribute('aria-sort', 'descending')
    await expect(names).toHaveText([`${tag} 1000`, `${tag} 300`, `${tag} 25`])
    await evidence(page, 'F02')
  })

  test('TC-SORT-02 (N): action columns and ledgers do not sort', async ({ page, request }) => {
    await as(page, request, ADMIN)
    await page.goto('/accounts')
    await expect(page.getByRole('columnheader', { name: 'ACTION' }).getByRole('button')).toHaveCount(0)
    await page.locator('tbody tr td:nth-child(2) a').first().click()
    await expect(page).toHaveURL(/\/ledger$/)
    await expect(page.locator('thead button')).toHaveCount(0) // a running balance only makes sense in date order
  })
})

test.describe('Reports', () => {
  test('TC-REP-01 (P): managers and accountants see the financial reports, administrators also see user reports', async ({ page, request }) => {
    const accountant = await createUser(request, uniquePerson('Riley'), 'ACCOUNTANT')
    await as(page, request, { username: accountant.username, password: accountant.password })
    await page.goto('/home')
    await page.getByRole('link', { name: 'Reports', exact: true }).click()
    await expect(page.locator('.report-card__label')).toHaveText(['CHART OF ACCOUNTS', 'JOURNAL ENTRIES', 'EVENT LOG'])
    await evidence(page, 'F03')
    await page.goto('/admin/reports/users')
    await expect(page).not.toHaveURL(/\/admin\/reports\/users$/) // user reports are admin only
  })

  for (const [id, path, title] of [
    ['TC-REP-02', '/reports/accounts', 'Chart of Accounts Report'],
    ['TC-REP-03', '/reports/journal', 'Journal Entries Report'],
    ['TC-REP-04', '/reports/event-log', 'Event Log Report'],
    ['TC-REP-05', '/admin/reports/users-by-status', 'Users by Status & Role'],
    ['TC-REP-06', '/admin/reports/users', 'All Users Report'],
    ['TC-REP-07', '/admin/reports/expired-passwords', 'Expired Passwords Report'],
  ]) {
    test(`${id} (P): ${title} loads and prints`, async ({ page, request }) => {
      await as(page, request, ADMIN)
      await page.addInitScript(() => {
        window.printed = 0
        window.print = () => (window.printed += 1)
      })
      await page.goto(path)
      await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible()
      await expect(page.locator('.report-meta')).toContainText('Generated')
      await expect(page.locator('tbody tr').first()).toBeVisible()
      await page.getByRole('button', { name: 'Print' }).click()
      expect(await page.evaluate(() => window.printed)).toBe(1)
      // The printout leaves out the menu, toolbar, filters and buttons
      await page.emulateMedia({ media: 'print' })
      await expect(page.locator('.app__sidebar')).toBeHidden()
      await expect(page.locator('.app__services')).toBeHidden()
      await expect(page.getByRole('button', { name: 'Print' })).toBeHidden()
      await expect(page.locator('.data-table').first()).toBeVisible()
      await evidence(page, `F-${id}`)
    })
  }

  test('TC-REP-08 (P): the users-by-status report counts users by role and status', async ({ page, request }) => {
    await as(page, request, ADMIN)
    const users = (await (await request.get('/api/users/reports/all', {
      headers: { Authorization: `Bearer ${(await (await request.post('/api/auth/login', { data: ADMIN })).json()).token}` },
    })).json()).filter((u) => u.username)
    const managers = users.filter((u) => u.role === 'MANAGER' && u.status === 'ACTIVATED').length
    await page.goto('/admin/reports/users-by-status')
    const managerRow = page.locator('tbody tr').filter({ hasText: 'Manager' }).first()
    await expect(managerRow.locator('td').nth(1)).toHaveText(String(managers))
    await expect(page.locator('tfoot')).toContainText(String(users.length))
  })

  test('TC-REP-09 (P/N): the journal report filters by status and date and totals the entries', async ({ page, request }) => {
    await as(page, request, ADMIN)
    await page.goto('/reports/journal')
    await page.getByLabel('Filter by status').selectOption('APPROVED')
    await expect(page.locator('.report-meta')).toContainText('Status: Approved')
    await expect(page.locator('tbody .num').first()).toBeVisible()
    await page.getByLabel('From date').fill('2001-01-01')
    await page.getByLabel('To date').fill('2001-01-31')
    await expect(page.getByText('No journal entries match these filters.')).toBeVisible()
    await expect(page.locator('tfoot')).toHaveCount(0)
  })
})

test.describe("What's New", () => {
  test("TC-NEW-01 (P): the version link opens release notes for every sprint", async ({ page, request }) => {
    await as(page, request, ADMIN)
    await page.goto('/admin')
    await page.getByRole('link', { name: /Version 3\.1 · What's New/ }).click()
    await expect(page).toHaveURL(/\/whats-new$/)
    await expect(page.locator('.release__title')).toHaveText([/^Version 3\.1/, /^Version 3\.0/, /^Version 2\.0/, /^Version 1\.0/])
    await evidence(page, 'F04')
  })
})

test.describe('Temporary passwords', () => {
  test('TC-TMP-01 (P): a new user\'s temporary password expires in 24 hours', async ({ page, request }) => {
    const user = await createUser(request, uniquePerson('Casey'))
    await signInAsAdmin(page)
    await page.goto(`/admin/users/${user.id}`)
    await expect(page.getByLabel('PASSWORD STATUS')).toHaveValue(/^Temporary, expires /)
    // And it signs in while it is still valid
    expect((await request.post('/api/auth/login', { data: { username: user.username, password: user.password } })).ok()).toBeTruthy()
  })

  test('TC-TMP-02 (P/N): an administrator issues a new temporary password; the old one stops working', async ({ page, request }) => {
    const user = await createUser(request, uniquePerson('Jordan'))
    await signInAsAdmin(page)
    await page.goto(`/admin/users/${user.id}`)
    await page.getByRole('button', { name: 'Issue Temporary Password' }).click()
    const shown = page.locator('.alert .secret')
    await expect(shown).toBeVisible()
    const fresh = await shown.textContent()
    await expect(page.locator('.alert').filter({ hasText: 'expires in 24 hours' })).toBeVisible()
    await evidence(page, 'F05')

    expect((await request.post('/api/auth/login', { data: { username: user.username, password: user.password } })).status()).toBe(401)
    await page.context().clearCookies()
    await page.evaluate(() => localStorage.clear())
    await signIn(page, user.username, fresh)
    await expect(page).toHaveURL(/\/home$/)
  })
})

test.describe('Status colours', () => {
  const GREEN = 'rgb(227, 241, 223)'
  const RED = 'rgb(251, 227, 223)'
  const badge = (row) => row.locator('.status-badge')

  test('TC-UI-12 (P/N): user accounts show Active in green and Suspended / Deactivated in red', async ({ page, request }) => {
    const tag = `Hue${Date.now().toString(36)}`
    const active = await createUser(request, uniquePerson(tag))
    const gone = await createUser(request, uniquePerson(tag))
    const headers = { Authorization: `Bearer ${await adminToken(request)}` }
    expect((await request.put(`/api/users/${gone.id}/deactivate`, { headers })).ok()).toBeTruthy()

    await as(page, request, ADMIN)
    await page.goto('/admin/users')
    await page.getByLabel('Search users').fill(tag)
    const row = (user) => page.getByRole('row', { name: new RegExp(user.username) })
    await expect(badge(row(active))).toHaveText('Active')
    await expect(badge(row(active))).toHaveCSS('background-color', GREEN)
    await expect(badge(row(gone))).toHaveText('Deactivated')
    await expect(badge(row(gone))).toHaveCSS('background-color', RED)
    await evidence(page, 'F06')
  })

  test('TC-UI-13 (P/N): chart of accounts shows Active in green and Inactive in red', async ({ page, request }) => {
    const tag = `Hue${Date.now().toString(36)}`
    const on = await createAccount(request, { ...uniqueAccount('Hue'), name: `${tag} On` })
    const off = await createAccount(request, { ...uniqueAccount('Hue'), name: `${tag} Off` })
    const headers = { Authorization: `Bearer ${await adminToken(request)}` }
    expect((await request.put(`/api/accounts/${off.id}/deactivate`, { headers })).ok()).toBeTruthy()

    await as(page, request, ADMIN)
    await page.goto('/accounts')
    await page.getByLabel('Search by account name or number').fill(tag)
    const row = (name) => page.getByRole('row', { name: new RegExp(name) })
    await expect(badge(row(`${tag} On`))).toHaveCSS('background-color', GREEN)
    await expect(badge(row(`${tag} Off`))).toHaveText('Inactive')
    await expect(badge(row(`${tag} Off`))).toHaveCSS('background-color', RED)
    await evidence(page, 'F07')
    await page.goto(`/accounts/${on.id}`)
    await expect(page.locator('.status-badge')).toHaveCSS('background-color', GREEN)
  })
})
