// Sprint 5: financial ratio dashboard (all roles, green/yellow/red, animated gauges, Customize tab), landing-page
// messages and menus, closing and reversing entries, opposite-side accounts grayed out, in-browser attachment viewer,
// double-ruled totals, Net Income (Loss), and the journal report's type filter.
// Runs on desktop, a tablet and two phones (see playwright.config.js). beforeAll creates this run's own users,
// accounts and entries, so the suite can be re-run on the same database.
// E2E_EVIDENCE_DIR=… keeps a screenshot per test (named <test case>-<device>) for the test-case document.
import { expect, test } from '@playwright/test'
import { ADMIN, api, as, createAccount, createUser, signIn, signOut, submitEntry, uniqueAccount, uniquePerson } from './helpers.js'
import { formatRatio } from '../src/ratios.js'

test.describe.configure({ mode: 'serial' })

const W = {}
const label = (a) => `${a.number} · ${a.name}`
const GREEN = 'rgb(28, 107, 52)'
const YELLOW = 'rgb(196, 138, 0)'
const RED = 'rgb(180, 35, 24)'
const BORDER = { GOOD: GREEN, WARNING: YELLOW, BAD: RED }
const STATUS_TEXT = { GOOD: 'Good', WARNING: 'Borderline', BAD: 'Needs a closer look', NONE: 'Not enough data' }
// Every ratio on the course's "Summary of Key Financial Ratios" sheet
const SHEET = {
  Profitability: ['Gross Profit Margin', 'Operating Profit Margin', 'Net Profit Margin', 'Return on Total Assets',
    "Return on Stockholders' Equity", 'Return on Common Equity', 'Earnings per Share'],
  Liquidity: ['Current Ratio', 'Quick (Acid-Test) Ratio', 'Inventory to Net Working Capital'],
  Leverage: ['Debt-to-Assets Ratio', 'Debt-to-Equity Ratio', 'Long-Term Debt-to-Equity', 'Times Interest Earned', 'Fixed-Charge Coverage'],
  Activity: ['Inventory Turnover', 'Fixed Assets Turnover', 'Total Assets Turnover', 'Accounts Receivable Turnover', 'Average Collection Period'],
  Other: ['Dividend Yield on Common Stock', 'Price-Earnings Ratio', 'Dividend Payout', 'Cash Flow per Share'],
}

const panel = (page) => page.locator('.ratio-panel')
const cards = (page) => page.locator('.ratio-card')
const card = (page, name) => page.locator('.ratio-card', { has: page.getByRole('heading', { name, exact: true }) })
const tab = (page, name) => page.getByRole('tab', { name })
const dropdown = (page, category) => page.locator('.ratio-dropdown', { hasText: `${category} ratios` })
const openDropdown = (page, category) => dropdown(page, category).locator('summary').click()
const chartType = (page) => page.getByLabel('Chart type')

// Screenshot per test and device, for the test-case document
async function evidence(page, id) {
  await expect(page.locator('.async-status', { hasText: 'Loading…' })).toHaveCount(0)
  // Charts load in their own chunk; wait until every one has drawn
  const charts = page.locator('.ratio-chart')
  await expect(charts.locator('canvas')).toHaveCount(await charts.count())
  if (process.env.E2E_EVIDENCE_DIR) await page.screenshot({ path: `${process.env.E2E_EVIDENCE_DIR}/${id}-${test.info().project.name}.png` })
}

const ratiosApi = async (request, token) => (await api(request, token, 'GET', '/statements/ratios')).body

async function openHome(page, who, path = '/home') {
  await as(page, who)
  await page.goto(path)
  await expect(cards(page).first()).toBeVisible()
}

test.beforeAll(async ({ request }) => {
  const login = async (username, password) => (await request.post('/api/auth/login', { data: { username, password } })).json()
  const user = async (first, role) => {
    const person = uniquePerson(first)
    const created = await createUser(request, person, role)
    const session = await login(created.username, created.password)
    return { ...person, ...created, session, token: session.token }
  }
  W.manager = await user('Quinn', 'MANAGER')
  W.accountant = await user('Sage', 'ACCOUNTANT')
  W.accountant2 = await user('Remy', 'ACCOUNTANT')
  const adminSession = await login(ADMIN.username, ADMIN.password)
  W.admin = { session: adminSession, token: adminSession.token }

  W.tag = `F${Date.now().toString(36)}`
  const account = async (name, prefix, fields) => createAccount(request, { ...uniqueAccount(name, prefix), name: `${name} ${W.tag}` }, fields)
  const income = (category, normal_side) => ({ category, subcategory: category, normal_side, statement: 'INCOME_STATEMENT' })
  W.cash = await account('Cash', '1', { initial_balance: '2000' })
  W.capital = await account("Owner's Capital", '3', { category: 'Equity', subcategory: "Owner's Equity", normal_side: 'RIGHT', initial_balance: '2000' })
  W.revenue = await account('Service Revenue', '4', income('Revenue', 'RIGHT'))
  W.rent = await account('Rent Expense', '5', income('Expense', 'LEFT'))

  // August: revenue of 900 and rent of 200 are approved, then a closing entry moves the revenue to capital.
  // The income statement must still show the 900 (statements leave closing entries out).
  const { accountant: A, manager: M } = W
  const approve = async (id) => expect((await api(request, M.token, 'PUT', `/journal-entries/${id}/approve`)).status).toBe(200)
  W.sale = await submitEntry(request, A, { date: '2026-08-10', description: 'August consulting', lines: [[W.cash, 'DEBIT', 900], [W.revenue, 'CREDIT', 900]] })
  W.rentPaid = await submitEntry(request, A, { date: '2026-08-15', lines: [[W.rent, 'DEBIT', 200], [W.cash, 'CREDIT', 200]] })
  W.closing = await submitEntry(request, A, { date: '2026-08-31', type: 'CLOSING', description: 'Close August revenue', lines: [[W.revenue, 'DEBIT', 900], [W.capital, 'CREDIT', 900]] })
  W.reversing = await submitEntry(request, A, { date: '2026-09-01', type: 'REVERSING', description: 'Reverse accrued rent', lines: [[W.capital, 'DEBIT', 40], [W.rent, 'CREDIT', 40]] })
  W.withFile = await submitEntry(request, A, { date: '2026-08-20', files: ['receipt.pdf'], lines: [[W.rent, 'DEBIT', 15], [W.cash, 'CREDIT', 15]] })
  for (const id of [W.sale, W.rentPaid, W.closing]) await approve(id)
  // W.reversing and W.withFile stay pending, so accountants have entries waiting for a manager
})

// ---------------------------------------------------------------------------------------------------------------
test.describe('Financial ratio dashboard', () => {
  test('TC-FR-01 (P): the API returns every ratio on the course ratio sheet, grouped by category', async ({ request }) => {
    const ratios = await ratiosApi(request, W.manager.token)
    expect(ratios).toHaveLength(24)
    for (const [category, names] of Object.entries(SHEET)) {
      expect(ratios.filter((r) => r.category === category).map((r) => r.name)).toEqual(names)
    }
    for (const r of ratios) expect(['GOOD', 'WARNING', 'BAD', 'NONE']).toContain(r.status)
  })

  test('TC-FR-02 (P): a manager lands on Home with the ratio dashboard, one card for each ratio that has data', async ({ page, request }) => {
    const ratios = await ratiosApi(request, W.manager.token)
    await openHome(page, W.manager)
    await expect(panel(page).getByRole('heading', { name: 'Financial ratios' })).toBeVisible()
    const shown = ratios.filter((r) => r.value != null)
    await expect(cards(page)).toHaveCount(shown.length)
    for (const r of shown) {
      const c = card(page, r.name)
      await expect(c.locator('.ratio-card__value')).toHaveText(formatRatio(r))
      await expect(c.locator('.ratio-card__range')).toHaveText(`Good: ${r.goodRange}`)
      await expect(c).toHaveAttribute('title', r.formula) // hover shows the formula
    }
    await evidence(page, 'TC-FR-02')
  })

  test('TC-FR-03 (P): accountants and administrators see the same dashboard on their landing pages', async ({ page }) => {
    await openHome(page, W.accountant)
    await expect(panel(page)).toBeVisible()
    const accountantCount = await cards(page).count()
    await openHome(page, W.admin, '/admin')
    await expect(page.getByRole('heading', { name: 'Administrator Dashboard' })).toBeVisible()
    await expect(cards(page)).toHaveCount(accountantCount)
    await evidence(page, 'TC-FR-03')
  })

  test('TC-FR-04 (P): every card is green, yellow or red to match its status, with the status written out', async ({ page, request }) => {
    const ratios = (await ratiosApi(request, W.manager.token)).filter((r) => r.value != null)
    await openHome(page, W.manager)
    for (const r of ratios) {
      const c = card(page, r.name)
      await expect(c).toHaveCSS('border-left-color', BORDER[r.status])
      await expect(c.locator('.ratio-card__status')).toHaveText(STATUS_TEXT[r.status])
    }
    await evidence(page, 'TC-FR-04')
  })

  test('TC-FR-05 (P): each status follows its green and yellow thresholds', async ({ request }) => {
    for (const r of await ratiosApi(request, W.manager.token)) {
      if (r.value == null) {
        expect(r.status, r.name).toBe('NONE')
        continue
      }
      const v = Number(r.value)
      const expected = r.higherIsBetter
        ? v >= r.good ? 'GOOD' : v >= r.warn ? 'WARNING' : 'BAD'
        : v < 0 || v > r.warn ? 'BAD' : v > r.good ? 'WARNING' : 'GOOD'
      expect(r.status, `${r.name} = ${v}`).toBe(expected)
    }
  })

  test('TC-FR-06 (P): ratio values agree with the balance sheet and income statement', async ({ request }) => {
    const today = new Date().toLocaleDateString('en-CA')
    const statement = async (type) => (await api(request, W.manager.token, 'GET', `/statements/${type}?date=${today}`)).body.totals
    const ratios = Object.fromEntries((await ratiosApi(request, W.manager.token)).map((r) => [r.key, r.value == null ? null : Number(r.value)]))
    const bs = await statement('balance-sheet')
    const is = await statement('income-statement')
    const round = (n) => Math.round(n * 10_000) / 10_000
    expect(ratios['debt-to-assets']).toBeCloseTo(round(bs.total_liabilities / bs.total_assets), 4)
    expect(ratios['debt-to-equity']).toBeCloseTo(round(bs.total_liabilities / bs.total_equity), 4)
    expect(ratios['net-margin']).toBeCloseTo(round(is.net_income / is.total_revenues), 4)
    expect(ratios['asset-turnover']).toBeCloseTo(round(is.total_revenues / bs.total_assets), 4)
  })

  test('TC-FR-07 (N): ratios the ledger cannot support are marked "no data" with a reason, and hidden by default', async ({ page, request }) => {
    const missing = (await ratiosApi(request, W.manager.token)).filter((r) => r.value == null)
    expect(missing.map((r) => r.name)).toEqual(expect.arrayContaining(['Earnings per Share', 'Fixed-Charge Coverage', 'Price-Earnings Ratio']))
    for (const r of missing) expect(r.note, r.name).toBeTruthy()
    await openHome(page, W.manager)
    for (const r of missing) await expect(card(page, r.name)).toHaveCount(0)
    await tab(page, 'Customize').click()
    await expect(page.locator('.ratio-option', { hasText: 'Earnings per Share' })).toContainText('(no data)')
    await openDropdown(page, 'Profitability')
    await page.getByLabel('Earnings per Share').check()
    await tab(page, 'Dashboard').click()
    const eps = card(page, 'Earnings per Share')
    await expect(eps.locator('.ratio-card__value')).toHaveText('—')
    await expect(eps.locator('.ratio-card__status')).toHaveText('Not enough data')
    await expect(eps.locator('.ratio-card__range')).toHaveText(missing.find((r) => r.key === 'eps').note)
    await expect(eps.locator('canvas')).toHaveCount(0) // no gauge without a value
    await evidence(page, 'TC-FR-07')
  })

  test('TC-FR-08 (P): every card with a value has an Apache ECharts gauge chart', async ({ page }) => {
    await openHome(page, W.manager)
    const withValue = cards(page).filter({ hasNot: page.locator('.ratio-card__value', { hasText: '—' }) })
    const n = await withValue.count()
    expect(n).toBeGreaterThan(0)
    await expect(page.locator('.ratio-chart canvas')).toHaveCount(n)
    const box = await page.locator('.ratio-chart canvas').first().boundingBox()
    expect(box.width).toBeGreaterThan(100)
    expect(box.height).toBeGreaterThan(50)
    await expect(page.locator('.ratio-chart').first()).toHaveAttribute('role', 'img')
    await expect(page.locator('.ratio-chart').first()).toHaveAttribute('aria-label', /: /)
    await evidence(page, 'TC-FR-08')
  })

  test('TC-FR-09 (P): with motion allowed, the gauge needle sweeps up to the value', async ({ page, request }) => {
    const moving = (await ratiosApi(request, W.manager.token)).find((r) => r.value != null && Number(r.value) > 0)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await as(page, W.manager)
    await page.goto('/home')
    const gaugeCanvas = card(page, moving.name).locator('canvas')
    await expect(gaugeCanvas).toBeVisible()
    const early = await gaugeCanvas.screenshot()
    await page.waitForTimeout(1600) // the sweep takes 1.2 s
    const settled = await gaugeCanvas.screenshot()
    await page.waitForTimeout(300)
    expect(early.equals(settled), 'needle was still moving at first').toBe(false)
    expect((await gaugeCanvas.screenshot()).equals(settled), 'needle stops at the value').toBe(true)
    await evidence(page, 'TC-FR-09')
  })

  test('TC-FR-10 (N): with reduced motion, the gauge is drawn at its value straight away', async ({ page, request }) => {
    const moving = (await ratiosApi(request, W.manager.token)).find((r) => r.value != null && Number(r.value) > 0)
    await openHome(page, W.manager) // the suite runs with reducedMotion: 'reduce'
    const gaugeCanvas = card(page, moving.name).locator('canvas')
    await expect(gaugeCanvas).toBeVisible()
    await page.waitForTimeout(100)
    const first = await gaugeCanvas.screenshot()
    await page.waitForTimeout(800)
    expect((await gaugeCanvas.screenshot()).equals(first)).toBe(true)
  })
})

// ---------------------------------------------------------------------------------------------------------------
test.describe('Customize tab', () => {
  test('TC-CUS-01 (P): Dashboard and Customize are tabs; Customize has one dropdown per category holding its ratios', async ({ page }) => {
    await openHome(page, W.manager)
    await expect(tab(page, 'Dashboard')).toHaveAttribute('aria-selected', 'true')
    await tab(page, 'Customize').click()
    await expect(tab(page, 'Customize')).toHaveAttribute('aria-selected', 'true')
    await expect(tab(page, 'Dashboard')).toHaveAttribute('aria-selected', 'false')
    await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'ratio-tab-customize')
    await expect(page.locator('.ratio-dropdown__title')).toHaveText(Object.keys(SHEET).map((c) => `${c} ratios`))
    await expect(page.locator('.ratio-dropdown input[type=checkbox]')).toHaveCount(24)
    // Closed by default: no checkbox shows until its category is opened
    for (const c of Object.keys(SHEET)) await expect(dropdown(page, c)).not.toHaveAttribute('open', '')
    await expect(page.locator('.ratio-dropdown input[type=checkbox]:visible')).toHaveCount(0)
    await openDropdown(page, 'Leverage')
    await expect(page.locator('.ratio-dropdown input[type=checkbox]:visible')).toHaveCount(SHEET.Leverage.length)
    await expect(dropdown(page, 'Leverage').locator('.ratio-option')).toHaveText(SHEET.Leverage.map((n) => new RegExp(n.replace(/[()]/g, '\\$&'))))
    await evidence(page, 'TC-CUS-01')
  })

  test('TC-CUS-02 (P): removing and adding ratios changes the dashboard and is kept after a reload', async ({ page }) => {
    await openHome(page, W.manager)
    const before = await cards(page).count()
    await tab(page, 'Customize').click()
    await openDropdown(page, 'Liquidity')
    const liquidityCount = dropdown(page, 'Liquidity').locator('.ratio-dropdown__count')
    const before3 = Number((await liquidityCount.textContent()).split(' ')[0])
    await page.getByLabel('Current Ratio').uncheck()
    await expect(liquidityCount).toHaveText(`${before3 - 1} of 3 shown`) // the dropdown says how many are on
    await openDropdown(page, 'Leverage')
    await page.getByLabel('Times Interest Earned').check()
    await tab(page, 'Dashboard').click()
    await expect(card(page, 'Current Ratio')).toHaveCount(0)
    await expect(card(page, 'Times Interest Earned')).toHaveCount(1)
    await expect(cards(page)).toHaveCount(before) // one out, one in
    await page.reload()
    await expect(card(page, 'Times Interest Earned')).toHaveCount(1)
    await expect(card(page, 'Current Ratio')).toHaveCount(0)
    await evidence(page, 'TC-CUS-02')
  })

  test('TC-CUS-03 (P): the chart type can be gauge, bar, ring or no chart, and is kept after a reload', async ({ page }) => {
    await openHome(page, W.manager)
    const n = await page.locator('.ratio-chart').count()
    await expect(page.locator('[data-chart=gauge] canvas')).toHaveCount(n)
    await tab(page, 'Customize').click()
    await expect(chartType(page).locator('option')).toHaveText(['Gauge', 'Bar', 'Ring', 'No chart'])
    for (const type of ['bar', 'ring']) {
      await chartType(page).selectOption(type)
      await tab(page, 'Dashboard').click()
      await expect(page.locator(`[data-chart=${type}] canvas`)).toHaveCount(n)
      await expect(page.locator('.ratio-chart:not([data-chart=' + type + '])')).toHaveCount(0)
      await evidence(page, `TC-CUS-03-${type}`)
      await tab(page, 'Customize').click()
    }
    await chartType(page).selectOption('none')
    await tab(page, 'Dashboard').click()
    await expect(page.locator('.ratio-chart')).toHaveCount(0)
    await expect(cards(page)).toHaveCount(n) // ratios stay, only the charts go
    await page.reload()
    await expect(cards(page).first()).toBeVisible()
    await expect(page.locator('.ratio-chart')).toHaveCount(0)
    await tab(page, 'Customize').click()
    await expect(chartType(page)).toHaveValue('none')
    await chartType(page).selectOption('gauge')
    await tab(page, 'Dashboard').click()
    await expect(page.locator('[data-chart=gauge] canvas')).toHaveCount(n)
  })

  test('TC-CUS-07 (P): bar and ring charts animate too, in the ratio\'s status color', async ({ page, request }) => {
    const moving = (await ratiosApi(request, W.manager.token)).find((r) => r.value != null && Number(r.value) > 0)
    for (const type of ['bar', 'ring']) {
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await as(page, W.manager)
      await page.addInitScript(([id, t]) => localStorage.setItem(`limitless.ratio-dashboard.${id}`, JSON.stringify({ selected: null, chart: t })), [W.manager.session.id, type])
      await page.goto('/home')
      const canvas = card(page, moving.name).locator(`[data-chart=${type}] canvas`)
      await expect(canvas).toBeVisible()
      const early = await canvas.screenshot()
      await page.waitForTimeout(1600)
      const settled = await canvas.screenshot()
      expect(early.equals(settled), `${type} was still growing at first`).toBe(false)
    }
  })

  test('TC-CUS-04 (N): Hide all leaves a message instead of an empty panel', async ({ page }) => {
    await openHome(page, W.manager)
    await tab(page, 'Customize').click()
    await page.getByRole('button', { name: 'Hide all' }).click()
    await expect(page.locator('.ratio-dropdown input:checked')).toHaveCount(0)
    for (const c of Object.keys(SHEET)) await expect(dropdown(page, c).locator('.ratio-dropdown__count')).toHaveText(`0 of ${SHEET[c].length} shown`)
    await tab(page, 'Dashboard').click()
    await expect(cards(page)).toHaveCount(0)
    await expect(panel(page)).toContainText('No ratios selected. Open Customize to pick some.')
    await evidence(page, 'TC-CUS-04')
  })

  test('TC-CUS-05 (P): Show all shows all 24 ratios, and Reset to default goes back to the ratios with data', async ({ page, request }) => {
    const withData = (await ratiosApi(request, W.manager.token)).filter((r) => r.value != null).length
    await openHome(page, W.manager)
    await tab(page, 'Customize').click()
    await page.getByRole('button', { name: 'Show all' }).click()
    for (const c of Object.keys(SHEET)) await expect(dropdown(page, c).locator('.ratio-dropdown__count')).toHaveText(`${SHEET[c].length} of ${SHEET[c].length} shown`)
    await tab(page, 'Dashboard').click()
    await expect(cards(page)).toHaveCount(24)
    await tab(page, 'Customize').click()
    await page.getByRole('button', { name: 'Reset to default' }).click()
    await expect(chartType(page)).toHaveValue('gauge')
    await tab(page, 'Dashboard').click()
    await expect(cards(page)).toHaveCount(withData)
    await evidence(page, 'TC-CUS-05')
  })

  test("TC-CUS-06 (N): one user's choices do not change another user's dashboard", async ({ page }) => {
    await signIn(page, W.accountant.username, W.accountant.password)
    await expect(cards(page).first()).toBeVisible()
    const defaultCount = await cards(page).count()
    await tab(page, 'Customize').click()
    await page.getByRole('button', { name: 'Hide all' }).click()
    await signOut(page)
    await signIn(page, W.accountant2.username, W.accountant2.password)
    await expect(cards(page)).toHaveCount(defaultCount)
    await evidence(page, 'TC-CUS-06')
  })
})

// ---------------------------------------------------------------------------------------------------------------
test.describe('Access, messages and menus', () => {
  test('TC-SEC-07 (N): ratios need sign-in; every role can read them but only managers open statements', async ({ request }) => {
    const anonymous = await request.get('/api/statements/ratios')
    expect([401, 403]).toContain(anonymous.status())
    for (const who of [W.accountant, W.admin, W.manager]) expect((await api(request, who.token, 'GET', '/statements/ratios')).status).toBe(200)
    expect((await api(request, W.accountant.token, 'GET', '/statements/trial-balance')).status).toBe(403)
    expect((await api(request, W.admin.token, 'GET', '/statements/balance-sheet')).status).toBe(403)
  })

  test("TC-MSG-01 (P): an accountant's home says how many entries are waiting for a manager, with a link", async ({ page, request }) => {
    const { count } = (await api(request, W.accountant.token, 'GET', '/journal-entries/pending-count')).body
    expect(count).toBeGreaterThan(0)
    await as(page, W.accountant)
    await page.goto('/home')
    const message = page.locator('.home-alert .alert')
    await expect(message).toContainText(`${count} journal ${count === 1 ? 'entry is' : 'entries are'} waiting for a manager's approval.`)
    await expect(message).not.toContainText('your approval')
    await message.getByRole('link', { name: 'View pending entries →' }).click()
    await expect(page).toHaveURL(/\/journal\?status=SUBMITTED$/)
    await evidence(page, 'TC-MSG-01')
  })

  test('TC-MSG-02 (P): a manager is still told entries are waiting for their approval, above the dashboard', async ({ page }) => {
    await openHome(page, W.manager)
    await expect(page.locator('.home-alert .alert')).toContainText('waiting for your approval')
    const alertBox = await page.locator('.home-alert').boundingBox()
    const panelBox = await panel(page).boundingBox()
    expect(alertBox.y).toBeLessThan(panelBox.y)
    await evidence(page, 'TC-MSG-02')
  })

  test('TC-NAV-01 (P): each landing page keeps the menu buttons that role uses elsewhere', async ({ page }) => {
    const menu = (page) => page.locator('.app__nav-link')
    await openHome(page, W.accountant)
    await expect(menu(page)).toHaveText(['Home', 'Accounts', 'Journal', 'Event Log', 'Reports', 'Email'])
    await expect(page.locator('.task-card')).toHaveCount(6) // no Financial statements card
    await openHome(page, W.manager)
    await expect(page.locator('.task-card', { hasText: 'Financial statements' })).toHaveCount(1)
    await openHome(page, W.admin, '/admin')
    await expect(menu(page)).toHaveText(['Dashboard', 'Users', 'Accounts', 'Journal', 'Event Log', 'Reports', 'Email'])
    for (const service of ['Chart of Accounts', 'Journalize', 'Event Log']) {
      await expect(page.locator('.app__service', { hasText: service })).toHaveCount(1)
    }
    await evidence(page, 'TC-NAV-01')
  })
})

// ---------------------------------------------------------------------------------------------------------------
test.describe('Closing and reversing entries', () => {
  test('TC-CR-01 (P): the journal form offers Regular, Adjusting, Closing and Reversing; a closing entry is saved as Closing', async ({ page }) => {
    await as(page, W.accountant)
    await page.goto('/journal/new')
    await expect(page.getByLabel('Type', { exact: true }).locator('option')).toHaveText(['Regular', 'Adjusting', 'Closing', 'Reversing'])
    await page.getByLabel('Type', { exact: true }).selectOption('CLOSING')
    await page.locator('input[type=date]').first().fill('2026-08-31')
    await page.getByLabel('Account for debit line 1').selectOption({ label: label(W.revenue) })
    await page.getByLabel('Amount for debit line 1').fill('5.00')
    await page.getByLabel('Account for credit line 1').selectOption({ label: label(W.capital) })
    await page.getByLabel('Amount for credit line 1').fill('5.00')
    await page.getByRole('button', { name: 'Submit for Approval' }).click()
    await expect(page).toHaveURL(/\/journal\/\d+$/)
    await expect(page.getByLabel('Type', { exact: true })).toHaveValue('Closing')
    await evidence(page, 'TC-CR-01')
  })

  test('TC-CR-02 (P): the journal filters to reversing entries only', async ({ page }) => {
    await as(page, W.manager)
    await page.goto('/journal')
    await page.getByLabel('Filter by entry type').selectOption('REVERSING')
    await page.getByLabel('Search by account name, amount or date').fill(W.tag)
    await expect(page.locator('tbody tr')).toHaveCount(1)
    await expect(page.getByRole('link', { name: `JE-${W.reversing}` })).toBeVisible()
    await expect(page.locator('tbody')).toContainText('Reversing')
    await evidence(page, 'TC-CR-02')
  })

  test('TC-CR-03 (N): an approved closing entry does not wipe out the income statement', async ({ page }) => {
    await as(page, W.manager)
    await page.goto('/reports/statements')
    await page.getByLabel('Statement', { exact: true }).selectOption({ label: 'Income Statement' })
    await page.getByLabel('Period').selectOption('range')
    await page.getByLabel('From date').fill('2026-08-01')
    await page.getByLabel('To date').fill('2026-08-31')
    const revenueRow = page.locator('.statement-table tbody tr', { has: page.getByRole('link', { name: W.revenue.name, exact: true }) })
    await expect(revenueRow).toContainText('$900.00')
    await evidence(page, 'TC-CR-03')
  })

  test('TC-CR-04 (N): an unknown entry type is refused with a message naming all four types', async ({ request }) => {
    const bad = await api(request, W.accountant.token, 'POST', '/journal-entries', {
      entry_date: '2026-08-31', entry_type: 'YEAR_END',
      lines: [{ account_id: W.cash.id, side: 'DEBIT', amount: 1 }, { account_id: W.revenue.id, side: 'CREDIT', amount: 1 }],
    })
    expect(bad.status).toBe(400)
    expect(JSON.stringify(bad.body)).toContain('REGULAR, ADJUSTING, CLOSING, or REVERSING')
  })

  test('TC-CR-05 (P): the Journal Entries report filters by entry type', async ({ page }) => {
    await as(page, W.manager)
    await page.goto('/reports/journal')
    await page.getByLabel('Filter by entry type').selectOption('CLOSING')
    await expect(page.locator('.report-meta')).toContainText('Type: Closing')
    const types = page.locator('tbody tr td:nth-child(4)')
    await expect(types.first()).toHaveText('Closing')
    for (const text of await types.allTextContents()) expect(text).toBe('Closing')
    await expect(page.getByRole('link', { name: `JE-${W.closing}` })).toBeVisible()
    await evidence(page, 'TC-CR-05')
  })
})

// ---------------------------------------------------------------------------------------------------------------
test.describe('Journal entry form and page', () => {
  test('TC-JF-01 (N): an account picked on one side is grayed out on the other side', async ({ page }) => {
    await as(page, W.accountant)
    await page.goto('/journal/new')
    await page.getByLabel('Account for debit line 1').selectOption({ label: label(W.cash) })
    const creditOption = page.getByLabel('Account for credit line 1').locator('option', { hasText: label(W.cash) })
    await expect(creditOption).toBeDisabled()
    await page.getByLabel('Account for credit line 1').selectOption({ label: label(W.revenue) })
    await expect(page.getByLabel('Account for debit line 1').locator('option', { hasText: label(W.revenue) })).toBeDisabled()
    // Changing the debit frees the account again
    await page.getByLabel('Account for debit line 1').selectOption({ label: label(W.rent) })
    await expect(creditOption).toBeEnabled()
    await evidence(page, 'TC-JF-01')
  })

  test('TC-JF-02 (P): clicking an attachment opens it in a new browser tab instead of downloading it', async ({ page }) => {
    await as(page, W.manager)
    await page.goto(`/journal/${W.withFile}`)
    let downloaded = false
    page.on('download', () => (downloaded = true))
    const [viewer] = await Promise.all([page.context().waitForEvent('page'), page.getByRole('button', { name: 'receipt.pdf', exact: true }).click()])
    await expect.poll(() => viewer.url()).toMatch(/^blob:/)
    expect(downloaded).toBe(false)
    await evidence(page, 'TC-JF-02')
  })

  test('TC-JF-03 (P): a file picked on the new-entry form can be viewed before submitting', async ({ page }) => {
    await as(page, W.accountant)
    await page.goto('/journal/new')
    await page.getByLabel(/Attach files/i).setInputFiles([{ name: 'invoice.png', mimeType: 'image/png', buffer: Buffer.from('89504e47', 'hex') }])
    const [viewer] = await Promise.all([page.context().waitForEvent('page'), page.getByRole('button', { name: 'invoice.png', exact: true }).click()])
    await expect.poll(() => viewer.url()).toMatch(/^blob:/)
    await evidence(page, 'TC-JF-03')
  })

  test('TC-JF-04 (P): the entry page lists its lines without a totals row', async ({ page }) => {
    await as(page, W.manager)
    await page.goto(`/journal/${W.sale}`)
    const lines = page.locator('.data-table').filter({ hasText: W.revenue.name })
    await expect(lines.locator('tbody tr')).toHaveCount(2)
    await expect(lines).not.toContainText('Totals')
    await evidence(page, 'TC-JF-04')
  })
})

// ---------------------------------------------------------------------------------------------------------------
test.describe('Reports', () => {
  test('TC-RPT-05 (P): report totals have a single rule above and a double rule below', async ({ page }) => {
    await as(page, W.manager)
    await page.goto('/reports/journal')
    const total = page.locator('tfoot td').first()
    await expect(total).toHaveCSS('border-bottom-style', 'double')
    await expect(total).toHaveCSS('border-top-style', 'solid')
    await page.goto('/reports/statements')
    await expect(page.locator('.statement-table tfoot td').first()).toHaveCSS('border-bottom-style', 'double')
    await evidence(page, 'TC-RPT-05')
  })

  test('TC-RPT-06 (P): the income statement ends with Net Income (Loss); retained earnings adds Net income (loss)', async ({ page }) => {
    await as(page, W.manager)
    await page.goto('/reports/statements')
    await page.getByLabel('Statement', { exact: true }).selectOption({ label: 'Income Statement' })
    await expect(page.locator('.statement-table tfoot')).toContainText('Net Income (Loss)')
    await page.getByLabel('Statement', { exact: true }).selectOption({ label: 'Retained Earnings Statement' })
    await expect(page.locator('.statement-table')).toContainText('Add: Net income (loss)')
    await evidence(page, 'TC-RPT-06')
  })

  test("TC-NEW-02 (P): What's New lists the Sprint 5 changes as version 5.0", async ({ page }) => {
    await as(page, W.manager)
    await page.goto('/whats-new')
    await expect(page.getByText('Sprint 5: Financial ratios dashboard, closing and reversing entries')).toBeVisible()
    await expect(page.getByText(/Customize tab picks the chart type/)).toBeVisible()
    await expect(page.locator('.release__title').first()).toContainText('Version 5.0')
    await evidence(page, 'TC-NEW-02')
  })
})

// ---------------------------------------------------------------------------------------------------------------
test.describe('Devices', () => {
  const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

  test('TC-DEV-01 (P): Home and the admin dashboard fit the screen width with the ratio dashboard on them', async ({ page }) => {
    await openHome(page, W.manager)
    expect(await overflow(page)).toBeLessThanOrEqual(0)
    await openHome(page, W.admin, '/admin')
    expect(await overflow(page)).toBeLessThanOrEqual(0)
    await tab(page, 'Customize').click()
    expect(await overflow(page)).toBeLessThanOrEqual(0)
    await evidence(page, 'TC-DEV-01')
  })

  test('TC-DEV-02 (P): ratio cards stack one per row on phones and sit side by side on wider screens', async ({ page }) => {
    await openHome(page, W.manager)
    const tops = await cards(page).evaluateAll((els) => els.slice(0, 3).map((el) => Math.round(el.getBoundingClientRect().top)))
    const width = page.viewportSize().width
    if (width < 500) expect(new Set(tops).size).toBe(tops.length)
    else expect(tops[0]).toBe(tops[1])
    const gauge = await page.locator('.ratio-chart canvas').first().boundingBox()
    const box = await cards(page).first().boundingBox()
    expect(gauge.x + gauge.width).toBeLessThanOrEqual(box.x + box.width + 1) // the chart stays inside its card
    await evidence(page, 'TC-DEV-02')
  })

  test('TC-DEV-03 (P): the tabs and checkboxes work by touch on tablets and phones', async ({ page }) => {
    test.skip(!test.info().project.use.hasTouch, 'touch devices only')
    await openHome(page, W.manager)
    await tab(page, 'Customize').tap()
    await expect(tab(page, 'Customize')).toHaveAttribute('aria-selected', 'true')
    await dropdown(page, 'Profitability').locator('summary').tap()
    await page.getByLabel('Net Profit Margin').tap()
    await expect(page.getByLabel('Net Profit Margin')).not.toBeChecked()
    await tab(page, 'Dashboard').tap()
    await expect(card(page, 'Net Profit Margin')).toHaveCount(0)
    const target = await tab(page, 'Customize').boundingBox()
    expect(target.height).toBeGreaterThanOrEqual(24) // big enough to hit with a finger
    await evidence(page, 'TC-DEV-03')
  })
})
