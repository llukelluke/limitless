// Frontend redesign: navigation, readability, contrast, tooltips, responsive layout, motion and the Home tasks.
// Runs against the real backend (MySQL + Spring Boot + `npm run dev`). E2E_EVIDENCE_DIR=… keeps named screenshots.
import { expect, test } from '@playwright/test'
import { ADMIN, as, createUser, evidence, signIn, uniquePerson } from './helpers.js'

test.describe.configure({ mode: 'serial' })

const W = {}
const MEMBER_NAV = ['Home', 'Accounts', 'Journal', 'Event Log', 'Reports', 'Email']
const ADMIN_NAV = ['Dashboard', 'Users', 'Accounts', 'Journal', 'Event Log', 'Reports', 'Email']
const KEY_PAGES = ['/home', '/accounts', '/journal', '/journal/new', '/event-log', '/reports', '/reports/statements', '/email']

const nav = (page) => page.getByRole('navigation', { name: 'Main' })

test.beforeAll(async ({ request }) => {
  const user = async (first, role) => {
    const person = uniquePerson(first)
    const created = await createUser(request, person, role)
    const login = await request.post('/api/auth/login', { data: { username: created.username, password: created.password } })
    const session = await login.json()
    return { ...person, ...created, session }
  }
  W.manager = await user('Dana', 'MANAGER')
  W.accountant = await user('Eli', 'ACCOUNTANT')
  const login = await request.post('/api/auth/login', { data: ADMIN })
  W.admin = { session: await login.json() }
})

// WCAG contrast ratio of an element's text against the first opaque background behind it
async function contrastOf(locator) {
  return locator.evaluate((el) => {
    const rgb = (c) => c.match(/[\d.]+/g).map(Number)
    const lum = ([r, g, b]) => {
      const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    let node = el
    let bg = null
    while (node) {
      const c = getComputedStyle(node).backgroundColor
      const parts = rgb(c)
      if (parts.length < 4 || parts[3] > 0.95) {
        bg = parts.slice(0, 3)
        break
      }
      node = node.parentElement
    }
    const fg = lum(rgb(getComputedStyle(el).color).slice(0, 3))
    const back = lum(bg ?? [255, 255, 255])
    return (Math.max(fg, back) + 0.05) / (Math.min(fg, back) + 0.05)
  })
}

// ---------------------------------------------------------------------------------------------------------------
test.describe('Navigation', () => {
  test('TC-UX-01 (P): the sidebar shows an icon and a label for every page, for managers and accountants', async ({ page }) => {
    await as(page, W.accountant)
    await page.goto('/home')
    const links = nav(page).getByRole('link')
    await expect(links).toHaveText(MEMBER_NAV)
    for (let i = 0; i < MEMBER_NAV.length; i += 1) await expect(links.nth(i).locator('svg')).toBeVisible()
    await evidence(page, 'TC-UX-01')
  })

  test('TC-UX-02 (P): administrators get Dashboard and Users in the sidebar as well', async ({ page }) => {
    await as(page, W.admin)
    await page.goto('/admin')
    await expect(nav(page).getByRole('link')).toHaveText(ADMIN_NAV)
    await expect(nav(page).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
    await evidence(page, 'TC-UX-02')
  })

  test('TC-UX-03 (P): every sidebar item opens its page and becomes the highlighted item', async ({ page }) => {
    await as(page, W.manager)
    await page.goto('/home')
    const paths = { Home: /\/home$/, Accounts: /\/accounts$/, Journal: /\/journal$/, 'Event Log': /\/event-log$/, Reports: /\/reports$/, Email: /\/email$/ }
    for (const [label, path] of Object.entries(paths)) {
      const link = nav(page).getByRole('link', { name: label, exact: true })
      await link.click()
      await expect(page).toHaveURL(path)
      await expect(link).toHaveAttribute('aria-current', 'page')
      await expect(nav(page).locator('[aria-current="page"]')).toHaveCount(1)
    }
    await evidence(page, 'TC-UX-03')
  })

  test('TC-UX-04 (P): the highlight slides to the active item', async ({ page }) => {
    await as(page, W.manager)
    await page.goto('/journal')
    const indicator = page.locator('.app__nav-indicator')
    const active = nav(page).getByRole('link', { name: 'Journal', exact: true })
    await expect(async () => {
      const [a, b] = [await indicator.boundingBox(), await active.boundingBox()]
      expect(Math.abs(a.y - b.y)).toBeLessThan(2)
      expect(Math.abs(a.height - b.height)).toBeLessThan(2)
    }).toPass()
    await nav(page).getByRole('link', { name: 'Reports', exact: true }).click()
    const reports = nav(page).getByRole('link', { name: 'Reports', exact: true })
    await expect(async () => {
      expect(Math.abs((await indicator.boundingBox()).y - (await reports.boundingBox()).y)).toBeLessThan(2)
    }).toPass()
    await evidence(page, 'TC-UX-04')
  })

  test('TC-UX-05 (P): the top bar keeps the services, calculator, help and user menu on every page', async ({ page }) => {
    await as(page, W.manager)
    for (const path of KEY_PAGES) {
      await page.goto(path)
      const services = page.getByRole('toolbar', { name: 'Services' })
      for (const name of ['Chart of Accounts', 'Journalize', 'Event Log']) await expect(services.getByRole('link', { name })).toBeVisible()
      for (const name of ['Calculator', 'Help']) await expect(services.getByRole('button', { name, exact: true })).toBeVisible()
      await expect(page.locator('.app__logo img').first()).toBeVisible()
    }
    await page.locator('.user-menu__trigger').click()
    await expect(page.locator('.user-menu__role')).toHaveText('Manager')
    await expect(page.getByRole('menuitem', { name: 'Sign Out' })).toBeVisible()
    await evidence(page, 'TC-UX-05')
  })

  test('TC-UX-06 (N): the sidebar and top bar stay on screen when a long page is scrolled', async ({ page }) => {
    await as(page, W.admin)
    await page.goto('/admin/users')
    await expect(page.locator('tbody tr').first()).toBeVisible()
    await page.mouse.wheel(0, 3000)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200)
    await expect(page.locator('.app__topbar')).toBeInViewport()
    await expect(nav(page)).toBeInViewport()
    await evidence(page, 'TC-UX-06')
  })
})

// ---------------------------------------------------------------------------------------------------------------
test.describe('Readability', () => {
  test('TC-UX-07 (P): body text is 15px and no visible text is smaller than 13px', async ({ page }) => {
    await as(page, W.manager)
    for (const path of KEY_PAGES) {
      await page.goto(path)
      await expect(page.locator('.page-header__title')).toBeVisible()
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('15px')
      const tiny = await page.evaluate(() =>
        [...document.querySelectorAll('body *')]
          .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && el.getClientRects().length)
          .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 13)
          .map((el) => `${el.tagName}.${el.className}: ${el.textContent.trim().slice(0, 30)}`),
      )
      expect(tiny, `${path} has text under 13px`).toEqual([])
    }
    await evidence(page, 'TC-UX-07')
  })

  test('TC-UX-08 (N): no form label, column heading or card title is written in all capitals', async ({ page }) => {
    await as(page, W.manager)
    const acronyms = /\b(PDF|CSV|JPG|PNG|URL|ID|PR|JE)\b/g
    for (const path of KEY_PAGES) {
      await page.goto(path)
      await expect(page.locator('.page-header__title')).toBeVisible()
      const shouting = await page.evaluate((source) => {
        const re = new RegExp(source, 'g')
        return [...document.querySelectorAll('label, th, legend, .panel__title, .toolbar__label, .report-card__label, .task-card__title, dt, .btn, .app__service')]
          .map((el) => el.textContent.replace(re, '').replace(/[^A-Za-z]/g, ''))
          .filter((text) => text.length > 3 && text === text.toUpperCase())
      }, acronyms.source)
      expect(shouting, `${path} has all-caps text`).toEqual([])
    }
    await evidence(page, 'TC-UX-08')
  })

  test('TC-UX-09 (P): text meets WCAG AA contrast (4.5:1) against its background', async ({ page }) => {
    await as(page, W.manager)
    await page.goto('/journal')
    await expect(page.locator('tbody tr').first()).toBeVisible()
    const samples = ['.page-header__title', '.page-header__subtitle', '.panel__title', '.toolbar__label', '.data-table th', '.data-table td a',
      '.status-badge', '.btn--primary', '.app__service', '.app__signed-in', '.app__nav-link--active', '.app__version']
    for (const selector of samples) {
      const ratio = await contrastOf(page.locator(selector).first())
      expect(ratio, `${selector} contrast ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5)
    }
    await page.goto('/journal/new')
    for (const selector of ['.field__label', '.field__control', '.journal-side__total', '.form-section__title']) {
      const ratio = await contrastOf(page.locator(selector).first())
      expect(ratio, `${selector} contrast ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5)
    }
    await evidence(page, 'TC-UX-09')
  })

  test('TC-UX-10 (P): every button and link button has a tooltip', async ({ page }) => {
    await as(page, W.manager)
    for (const path of KEY_PAGES) {
      await page.goto(path)
      await expect(page.locator('.page-header__title')).toBeVisible()
      const missing = await page.evaluate(() =>
        [...document.querySelectorAll('button, .btn')]
          .filter((el) => el.getClientRects().length && !el.closest('.pac'))
          .filter((el) => !el.getAttribute('title'))
          .map((el) => el.textContent.trim() || el.getAttribute('aria-label')),
      )
      expect(missing, `${path} buttons without a tooltip`).toEqual([])
    }
    await evidence(page, 'TC-UX-10')
  })

  test('TC-UX-11 (P): a focused field shows a visible focus ring', async ({ page }) => {
    await as(page, W.manager)
    await page.goto('/email')
    const subject = page.getByLabel('SUBJECT')
    const before = await subject.evaluate((el) => getComputedStyle(el).boxShadow)
    await subject.focus()
    await expect.poll(() => subject.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe(before)
    await expect(subject).toHaveCSS('border-top-color', 'rgb(29, 79, 196)')
    await evidence(page, 'TC-UX-11')
  })
})

// ---------------------------------------------------------------------------------------------------------------
test.describe('Home for new users', () => {
  test('TC-UX-12 (P): a manager is offered seven task shortcuts that open the right pages', async ({ page }) => {
    await as(page, W.manager)
    await page.goto('/home')
    const cards = page.locator('.task-card')
    await expect(cards).toHaveCount(7)
    await expect(page.locator('.task-card__title')).toHaveText(['Record a journal entry', 'Look up an account', 'Review the journal',
      'Financial statements', 'Reports', 'See recent changes', 'Ask a question'])
    await evidence(page, 'TC-UX-12')
    await cards.filter({ hasText: 'Record a journal entry' }).click()
    await expect(page).toHaveURL(/\/journal\/new$/)
    await page.goBack()
    await cards.filter({ hasText: 'Financial statements' }).click()
    await expect(page).toHaveURL(/\/reports\/statements$/)
  })

  test('TC-UX-13 (N): an accountant is not offered financial statements', async ({ page }) => {
    await as(page, W.accountant)
    await page.goto('/home')
    await expect(page.locator('.task-card')).toHaveCount(6)
    await expect(page.locator('.task-card', { hasText: 'Financial statements' })).toHaveCount(0)
    await expect(page.locator('.page-header__subtitle')).toHaveText('You are signed in as an accountant. Pick a task below to get started.')
    await evidence(page, 'TC-UX-13')
  })
})

// ---------------------------------------------------------------------------------------------------------------
test.describe('Motion', () => {
  test('TC-UX-14 (P): pages fade in and cards lift on hover', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await as(page, W.manager)
    await page.goto('/home')
    await expect(page.locator('.app__content')).toHaveCSS('animation-name', 'fade-up')
    expect(parseFloat(await page.locator('.app__content').evaluate((el) => getComputedStyle(el).animationDuration))).toBeGreaterThan(0.1)
    const card = page.locator('.task-card').first()
    await card.hover()
    await expect.poll(() => card.evaluate((el) => getComputedStyle(el).transform)).not.toBe('none')
    await page.getByTitle('Open calendar').click()
    await expect(page.locator('.calendar__popup')).toHaveCSS('animation-name', 'pop-in')
    await evidence(page, 'TC-UX-14')
  })

  test('TC-UX-15 (N): with reduced motion turned on, nothing animates', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await as(page, W.manager)
    await page.goto('/home')
    for (const selector of ['.app__content', '.page-panel', '.task-card']) {
      const seconds = await page.locator(selector).first().evaluate((el) => parseFloat(getComputedStyle(el).animationDuration))
      expect(seconds, selector).toBeLessThan(0.001)
    }
    const transition = await page.locator('.btn, .task-card').first().evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration))
    expect(transition).toBeLessThan(0.001)
  })

  test('TC-UX-16 (N): a statement that does not balance shows its warning without scrolling the page', async ({ page }) => {
    await as(page, W.manager)
    await page.goto('/reports/statements')
    await expect(page.locator('.statement-title')).toBeVisible()
    await page.waitForTimeout(300)
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
    await evidence(page, 'TC-UX-16')
  })
})

// ---------------------------------------------------------------------------------------------------------------
test.describe('Smaller screens', () => {
  test('TC-UX-17 (P): on a tablet the sidebar becomes an icon rail that still works', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1000 })
    await as(page, W.manager)
    await page.goto('/home')
    const accounts = nav(page).getByRole('link', { name: 'Accounts', exact: true })
    await expect(accounts.locator('.app__nav-label')).toBeHidden()
    await expect(accounts.locator('svg')).toBeVisible()
    await expect(accounts).toHaveAttribute('title', 'View the chart of accounts')
    await accounts.click()
    await expect(page).toHaveURL(/\/accounts$/)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await evidence(page, 'TC-UX-17')
  })

  test('TC-UX-18 (P): on a phone the menu moves to the top and nothing spills off the side', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await as(page, W.manager)
    for (const path of ['/home', '/journal/new', '/email']) {
      await page.goto(path)
      await expect(page.locator('.page-header__title')).toBeVisible()
      const box = await page.locator('.app__sidebar').boundingBox()
      expect(box.width).toBeGreaterThan(380)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
    }
    await evidence(page, 'TC-UX-18')
  })

  test('TC-UX-19 (N): a wide table scrolls inside its card instead of squashing columns', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1000 })
    await as(page, W.manager)
    await page.goto('/journal')
    const scroll = page.locator('.data-table__scroll').first()
    await expect(page.locator('tbody tr').first()).toBeVisible()
    expect(await scroll.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await evidence(page, 'TC-UX-19')
  })
})

// ---------------------------------------------------------------------------------------------------------------
test.describe('Sign-in screens', () => {
  test('TC-UX-20 (P): the sign-in screen shows the logo panel and a clear form card', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('.auth__brand .auth__emblem')).toBeVisible()
    await expect(page.locator('.auth-form')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Help', exact: true })).toBeVisible()
    await signIn(page, W.manager.username, W.manager.password)
    await expect(page).toHaveURL(/\/home$/)
    await evidence(page, 'TC-UX-20')
  })

  test('TC-UX-21 (N): a wrong password is shown in red on the sign-in card', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Username', { exact: true }).fill(W.manager.username)
    await page.getByLabel('Password', { exact: true }).fill('Wrong123!')
    await page.getByRole('button', { name: 'Sign In' }).click()
    const message = page.locator('.alert--error')
    await expect(message).toBeVisible()
    await expect(message).toHaveCSS('color', 'rgb(180, 35, 24)')
    await evidence(page, 'TC-UX-21')
  })

  test('TC-UX-22 (P): Forgot Password uses the same light card and fields', async ({ page }) => {
    await page.goto('/forgot-password')
    const card = page.locator('.forgot-password-card')
    await expect(card).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    await page.getByRole('button', { name: 'Send Reset Link' }).click()
    await expect(page.locator('.forgot-password-error')).toHaveText('Please enter your email address.')
    await expect(page.locator('#forgot-password-email')).toHaveAttribute('aria-invalid', 'true')
    await evidence(page, 'TC-UX-22')
  })
})
