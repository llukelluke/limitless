import { expect, test } from '@playwright/test'
import {
  adminToken,
  alert,
  createAccount,
  createUser,
  signIn,
  signInAsAdmin,
  uniqueAccount,
  uniquePerson,
} from './helpers.js'

// Fills the Add/Edit Account form. Only the keys given are changed.
async function fillAccount(page, values) {
  const fields = {
    name: ['ACCOUNT NAME'],
    number: ['ACCOUNT NUMBER'],
    subcategory: ['SUBCATEGORY'],
    order: ['ORDER'],
    description: ['DESCRIPTION'],
    initial_balance: ['INITIAL BALANCE'],
    comment: ['COMMENT'],
  }
  if (values.category) await page.getByLabel('CATEGORY', { exact: true }).selectOption(values.category)
  if (values.side) await page.getByLabel('NORMAL SIDE').selectOption(values.side)
  if (values.statement) await page.getByLabel('STATEMENT').selectOption(values.statement)
  for (const [key, [label]] of Object.entries(fields)) {
    if (values[key] !== undefined) await page.getByLabel(label, { exact: true }).fill(values[key])
  }
}

const validAccount = (account) => ({
  ...account,
  category: 'Asset',
  subcategory: 'Current Assets',
  statement: 'BALANCE_SHEET',
  order: '01',
  initial_balance: '0',
})

async function apiAs(request, username, password) {
  const { token } = await (await request.post('/api/auth/login', { data: { username, password } })).json()
  return { Authorization: `Bearer ${token}` }
}

test.describe('Chart of accounts — administrator', () => {
  test('TC-ACC-01 (P): admin adds an account; money is formatted and the addition is logged', async ({ page }) => {
    const account = uniqueAccount('Cash')
    await signInAsAdmin(page)
    await page.goto('/accounts')
    await page.getByRole('link', { name: 'Add Account' }).click()
    await expect(page).toHaveURL(/\/accounts\/new$/)

    await fillAccount(page, {
      ...validAccount(account),
      description: 'Cash on hand',
      initial_balance: '1250.5',
      comment: 'Opened by e2e',
    })
    // Normal side follows the category
    await expect(page.getByLabel('NORMAL SIDE')).toHaveValue('LEFT')
    await page.getByLabel('INITIAL BALANCE').blur()
    await expect(page.getByLabel('INITIAL BALANCE')).toHaveValue('1,250.50')
    await page.getByRole('button', { name: 'Add Account' }).click()

    await expect(page).toHaveURL(/\/accounts\/\d+$/)
    await expect(alert(page)).toHaveText('Account added.')
    await expect(page.getByLabel('ACCOUNT NUMBER')).toHaveValue(account.number)
    await expect(page.getByLabel('INITIAL BALANCE')).toHaveValue('$1,250.50')
    await expect(page.getByLabel('BALANCE', { exact: true })).toHaveValue('$1,250.50')
    await expect(page.getByLabel('DEBIT')).toHaveValue('$0.00')
    await expect(page.getByLabel('NORMAL SIDE')).toHaveValue('Debit')
    await expect(page.getByLabel('ORDER')).toHaveValue('01')
    await expect(page.getByLabel('ADDED BY')).toHaveValue('sadmin1026')
    await expect(page.getByLabel('DATE ADDED')).toHaveValue(/\d{4}, \d{1,2}:\d{2} (AM|PM)$/)
    await expect(page.getByRole('cell', { name: 'Added', exact: true })).toBeVisible()
    // Evidence screenshot: balances and the logged event
    await page.getByRole('heading', { name: 'CHANGE HISTORY' }).scrollIntoViewIfNeeded()
  })

  test('TC-ACC-02 (N): duplicate account names and numbers are rejected', async ({ page, request }) => {
    const existing = await createAccount(request, uniqueAccount('Dup'))
    await signInAsAdmin(page)

    await page.goto('/accounts/new')
    await fillAccount(page, validAccount({ name: existing.name, number: uniqueAccount().number }))
    await page.getByRole('button', { name: 'Add Account' }).click()
    await expect(alert(page)).toHaveText('An account with this name already exists.')

    await fillAccount(page, { name: uniqueAccount('Other').name, number: String(existing.number) })
    await page.getByRole('button', { name: 'Add Account' }).click()
    await expect(alert(page)).toHaveText('An account with this number already exists.')
    await alert(page).scrollIntoViewIfNeeded()
  })

  test('TC-ACC-03 (N): account numbers allow digits only and must start with the category digit', async ({ page }) => {
    await signInAsAdmin(page)
    await page.goto('/accounts/new')

    // Letters and decimal points are dropped as they are typed
    await page.getByLabel('ACCOUNT NUMBER').fill('1a0.1b')
    await expect(page.getByLabel('ACCOUNT NUMBER')).toHaveValue('101')

    await fillAccount(page, { ...validAccount(uniqueAccount('Prefix', '2')) })
    await expect(page.getByText('Asset numbers start with 1')).toBeVisible()
    await page.getByRole('button', { name: 'Add Account' }).click()
    await expect(alert(page)).toHaveText('Asset account numbers must start with 1.')
    await alert(page).scrollIntoViewIfNeeded()
  })

  test('TC-ACC-04 (N): required fields and money with more than two decimals are rejected', async ({ page }) => {
    await signInAsAdmin(page)
    await page.goto('/accounts/new')
    await page.getByRole('button', { name: 'Add Account' }).click()
    await expect(alert(page)).toHaveText(
      'Name, number, category, subcategory, normal side, statement, and order are required.',
    )

    await fillAccount(page, { ...validAccount(uniqueAccount('Money')), initial_balance: '10.555' })
    await page.getByRole('button', { name: 'Add Account' }).click()
    await expect(alert(page)).toHaveText(
      'Initial balance must be an amount with at most two decimal places, for example 1,250.00.',
    )
    await alert(page).scrollIntoViewIfNeeded()
  })

  test('TC-ACC-05 (N): the API rejects decimal, alphanumeric and wrong-prefix numbers and bad money', async ({ request }) => {
    const headers = { Authorization: `Bearer ${await adminToken(request)}` }
    const base = {
      name: uniqueAccount('Api').name,
      category: 'Asset',
      subcategory: 'Current Assets',
      normal_side: 'LEFT',
      statement: 'BALANCE_SHEET',
      order: '1',
      initial_balance: '0',
    }
    const cases = [
      [{ number: '10.5' }, 'Account number must contain digits only.'],
      [{ number: '10a' }, 'Account number must contain digits only.'],
      [{ number: '401' }, 'Asset account numbers must start with 1.'],
      [{ number: uniqueAccount().number, initial_balance: '1.234' }, 'Monetary values must be numbers with at most two decimal places.'],
      [{ number: uniqueAccount().number, category: 'Cash' }, 'Unknown account category.'],
    ]
    for (const [fields, message] of cases) {
      const response = await request.post('/api/accounts', { headers, data: { ...base, ...fields } })
      expect(response.status(), JSON.stringify(fields)).toBe(400)
      expect((await response.json()).message).toBe(message)
    }
  })

  test('TC-ACC-06 (P): admin edits an account; the event log keeps before and after images', async ({ page, request }) => {
    const account = await createAccount(request, uniqueAccount('Edit'))
    const renamed = `${account.name} Renamed`
    await signInAsAdmin(page)
    await page.goto(`/accounts/${account.id}`)
    await page.getByRole('link', { name: 'Edit Account' }).click()
    await expect(page).toHaveURL(new RegExp(`/accounts/${account.id}/edit$`))

    await fillAccount(page, { name: renamed, initial_balance: '75' })
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect(alert(page)).toHaveText('Changes saved.')
    await expect(page.getByLabel('ACCOUNT NAME')).toHaveValue(renamed)
    await expect(page.getByLabel('BALANCE', { exact: true })).toHaveValue('$75.00')

    await page.getByRole('link', { name: 'Event Log', exact: true }).first().click()
    const row = page.getByRole('row').filter({ hasText: `Account #${account.id}` }).filter({ hasText: 'Modified' })
    await row.getByText(/Changed: .*name/).click()
    await expect(row.getByRole('row').filter({ hasText: 'name' }).first()).toContainText(account.name)
    await expect(row.getByRole('row').filter({ hasText: renamed })).toBeVisible()
    await expect(row).toContainText('sadmin1026')
  })

  test('TC-ACC-07 (N): editing to a duplicate name is rejected', async ({ page, request }) => {
    const first = await createAccount(request, uniqueAccount('First'))
    const second = await createAccount(request, uniqueAccount('Second'))
    await signInAsAdmin(page)
    await page.goto(`/accounts/${second.id}/edit`)
    await fillAccount(page, { name: first.name })
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect(alert(page)).toHaveText('An account with this name already exists.')
    await alert(page).scrollIntoViewIfNeeded()
  })

  test('TC-ACC-08 (N): an account with a balance above zero cannot be deactivated', async ({ page, request }) => {
    const account = await createAccount(request, uniqueAccount('Funded'), { initial_balance: '500.00' })
    await signInAsAdmin(page)
    await page.goto(`/accounts/${account.id}`)
    const button = page.getByRole('button', { name: 'Deactivate' })
    await expect(button).toBeDisabled()
    await expect(button).toHaveAttribute('title', 'Accounts with a balance greater than zero cannot be deactivated')

    const response = await request.put(`/api/accounts/${account.id}/deactivate`, {
      headers: { Authorization: `Bearer ${await adminToken(request)}` },
    })
    expect(response.status()).toBe(400)
    expect((await response.json()).message).toBe('Accounts with a balance greater than zero cannot be deactivated.')
  })

  test('TC-ACC-09 (P): a zero-balance account is deactivated and the change is logged', async ({ page, request }) => {
    const account = await createAccount(request, uniqueAccount('Empty'))
    await signInAsAdmin(page)
    await page.goto(`/accounts/${account.id}`)
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Deactivate' }).click()
    await expect(alert(page)).toHaveText('Account deactivated.')
    await expect(page.getByLabel('STATUS')).toHaveValue('Inactive')
    await expect(page.getByRole('cell', { name: 'Deactivated', exact: true })).toBeVisible()
    await page.getByRole('heading', { name: 'CHANGE HISTORY' }).scrollIntoViewIfNeeded()
  })
})

test.describe('Chart of accounts — viewing, search and ledger', () => {
  test('TC-ACC-10 (P/N): search by name or number and filter by category, statement, status and amount', async ({ page, request }) => {
    const tag = uniqueAccount('Find').name.split(' ')[1]
    const cash = await createAccount(request, { name: `Find Cash ${tag}`, number: uniqueAccount().number }, { initial_balance: '2,000.00' })
    const payable = await createAccount(
      request,
      { name: `Find Payable ${tag}`, number: uniqueAccount('x', '2').number },
      { category: 'Liability', subcategory: 'Current Liabilities', normal_side: 'RIGHT', initial_balance: '50' },
    )
    await signInAsAdmin(page)
    await page.goto('/accounts')
    const table = page.locator('.data-table')

    await page.getByLabel('Search by account name or number').fill(tag)
    await expect(table.getByText(cash.name)).toBeVisible()
    await expect(table.getByText(payable.name)).toBeVisible()
    await expect(table.getByText('$2,000.00')).toBeVisible()

    await page.getByLabel('Filter by category').selectOption('Liability')
    await expect(table.getByText(cash.name)).toHaveCount(0)
    await expect(table.getByText(payable.name)).toBeVisible()
    await page.getByLabel('Filter by category').selectOption('')

    await page.getByLabel('Minimum balance').fill('1,000')
    await expect(table.getByText(cash.name)).toBeVisible()
    await expect(table.getByText(payable.name)).toHaveCount(0)
    await page.getByLabel('Minimum balance').fill('')

    await page.getByLabel('Search by account name or number').fill(String(payable.number))
    await expect(table.getByText(payable.name)).toBeVisible()
    await expect(table.getByText(cash.name)).toHaveCount(0)

    await page.getByLabel('Filter by status').selectOption('inactive')
    await expect(page.getByText('No accounts match these filters.')).toBeVisible()
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(page.getByLabel('Search by account name or number')).toHaveValue('')
  })

  test('TC-ACC-11 (P): clicking an account name opens its ledger', async ({ page, request }) => {
    const account = await createAccount(request, uniqueAccount('Ledger'), { initial_balance: '320.10' })
    await signInAsAdmin(page)
    await page.goto('/accounts')
    await page.getByLabel('Search by account name or number').fill(account.name)
    await page.getByRole('link', { name: account.name }).click()
    await expect(page).toHaveURL(new RegExp(`/accounts/${account.id}/ledger$`))
    await expect(page.getByRole('heading', { name: `${account.number} · ${account.name}` })).toBeVisible()
    const opening = page.getByRole('row').filter({ hasText: 'Opening balance' })
    await expect(opening).toContainText('$320.10')
  })
})

test.describe('Chart of accounts — manager and accountant', () => {
  for (const role of ['MANAGER', 'ACCOUNTANT']) {
    test(`TC-ACC-12 (P/N): ${role.toLowerCase()} can view accounts but cannot add, edit or deactivate`, async ({ page, request }) => {
      const account = await createAccount(request, uniqueAccount('ViewOnly'))
      const user = await createUser(request, uniquePerson('Viewer'), role)
      await signIn(page, user.username, user.password)
      await expect(page).toHaveURL(/\/home$/)

      await page.getByRole('link', { name: 'Chart of Accounts', exact: true }).first().click()
      await page.getByLabel('Search by account name or number').fill(account.name)
      await expect(page.getByRole('link', { name: account.name })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Add Account' })).toHaveCount(0)
      await expect(page.getByRole('link', { name: /^Edit/ })).toHaveCount(0)

      await page.goto(`/accounts/${account.id}`)
      await expect(page.getByLabel('ACCOUNT NAME')).toHaveValue(account.name)
      await expect(page.getByRole('link', { name: 'Edit Account' })).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Deactivate' })).toHaveCount(0)

      for (const path of ['/accounts/new', `/accounts/${account.id}/edit`]) {
        await page.goto(path)
        await expect(page).toHaveURL(/\/home$/)
      }

      const headers = await apiAs(request, user.username, user.password)
      expect((await request.get('/api/accounts', { headers })).status()).toBe(200)
      expect((await request.get(`/api/event-logs?table=accounts&record_id=${account.id}`, { headers })).status()).toBe(200)
      expect((await request.post('/api/accounts', { headers, data: { name: 'x', number: '199' } })).status()).toBe(403)
      expect((await request.put(`/api/accounts/${account.id}`, { headers, data: { name: 'x' } })).status()).toBe(403)
      expect((await request.put(`/api/accounts/${account.id}/deactivate`, { headers })).status()).toBe(403)

      // Final screen for the evidence screenshot: loaded chart, no admin controls, role shown in the user menu
      await page.goto('/accounts')
      await page.getByLabel('Search by account name or number').fill(account.name)
      await expect(page.getByRole('link', { name: account.name })).toBeVisible()
      await page.locator('.user-menu__trigger').click()
      await expect(page.locator('.user-menu__role')).toHaveText(role === 'MANAGER' ? 'Manager' : 'Accountant')
    })
  }

  test('TC-ACC-13 (N): account pages and APIs require sign-in', async ({ page, request }) => {
    for (const path of ['/accounts', '/event-log', '/accounts/1/ledger']) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/login$/)
    }
    expect((await request.get('/api/accounts')).status()).toBe(403)
    expect((await request.get('/api/event-logs')).status()).toBe(403)
  })
})

test.describe('Sprint 2 page layout', () => {
  test('TC-UI-09 (P): username and pop-up calendar sit in the top left; service buttons and help on every page', async ({ page }) => {
    await signInAsAdmin(page)
    for (const path of ['/admin', '/admin/users', '/accounts', '/event-log']) {
      await page.goto(path)
      const session = page.locator('.app__session')
      await expect(session).toContainText('Signed in as sadmin1026')
      const box = await session.boundingBox()
      expect(box.x).toBeLessThan(100)
      expect(box.y).toBeLessThan(100)
      await expect(page.locator('.app__logo img').first()).toBeVisible()
      const services = page.getByRole('toolbar', { name: 'Services' })
      for (const name of ['Chart of Accounts', 'Journalize', 'Event Log', '? Help']) {
        await expect(services.getByRole(name === 'Journalize' || name === '? Help' ? 'button' : 'link', { name })).toBeVisible()
      }
    }

    await page.getByTitle('Open calendar').click()
    const calendar = page.getByRole('dialog', { name: 'Calendar' })
    await expect(calendar).toBeVisible()
    const month = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })
    await expect(calendar).toContainText(month)
    await calendar.getByTitle('Next month').click()
    await expect(calendar).not.toContainText(month)
  })

  test('TC-UI-10 (P): help is organized by topic', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: '? Help' }).click()
    const help = page.getByRole('dialog', { name: 'Help' })
    await expect(help).toBeVisible()
    await help.getByRole('button', { name: 'Chart of Accounts' }).click()
    await expect(help.getByRole('heading', { name: 'Chart of Accounts' })).toBeVisible()
    await help.getByRole('button', { name: 'Adding & Editing Accounts' }).click()
    await expect(help).toContainText('1 Asset, 2 Liability, 3 Equity, 4 Revenue, 5 Expense')
  })

  test('TC-UI-11 (P): every button has a tooltip', async ({ page, request }) => {
    const account = await createAccount(request, uniqueAccount('Tips'))
    await signInAsAdmin(page)
    for (const path of ['/admin', '/admin/users', '/admin/users/new', '/accounts', '/accounts/new', `/accounts/${account.id}`, `/accounts/${account.id}/edit`, '/event-log']) {
      await page.goto(path)
      await expect(page.locator('.page-header')).toBeVisible()
      const untitled = await page.locator('button:visible, a.btn:visible').evaluateAll((elements) =>
        elements.filter((el) => !el.title).map((el) => el.textContent.trim()),
      )
      expect(untitled, `buttons without tooltips on ${path}`).toEqual([])
    }
  })
})
