import { expect, test } from '@playwright/test'
import { ADMIN, alert, createUser, signIn, signInAsAdmin, uniquePerson } from './helpers.js'

test.describe('Access control and session', () => {
  test('TC-SEC-01 (N): admin pages require sign-in', async ({ page }) => {
    for (const path of ['/admin', '/admin/users', '/admin/reports', '/home']) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/login$/)
    }
  })

  test('TC-SEC-02/04 (N): managers cannot reach admin pages or admin APIs', async ({ page, request }) => {
    const user = await createUser(request, uniquePerson('Guard'), 'MANAGER')
    await signIn(page, user.username, user.password)
    await expect(page).toHaveURL(/\/home$/)
    await page.goto('/admin/users')
    await expect(page).toHaveURL(/\/home$/)

    const { token } = await (await request.post('/api/auth/login', {
      data: { username: user.username, password: user.password },
    })).json()
    const headers = { Authorization: `Bearer ${token}` }
    expect((await request.get('/api/users', { headers })).status()).toBe(403)
    expect((await request.post(`/api/users/${user.id}/send-email`, {
      headers, data: { subject: 'x', body: 'y' },
    })).status()).toBe(403)
    expect((await request.put(`/api/auth/access-requests/${user.id}/approve`, { headers })).status()).toBe(403)
  })

  test('TC-SEC-03 (N): admin APIs reject requests with no or a forged token', async ({ request }) => {
    expect((await request.get('/api/users')).status()).toBe(403)
    expect((await request.get('/api/users', { headers: { Authorization: 'Bearer forged.token.value' } })).status()).toBe(403)
  })

  test('TC-SEC-05 (P): session survives a page reload', async ({ page }) => {
    await signInAsAdmin(page)
    await page.goto('/admin/users')
    await page.reload()
    await expect(page).toHaveURL(/\/admin\/users$/)
  })

  test('TC-SEC-06 (N): an expired session signs the user out', async ({ page }) => {
    await signInAsAdmin(page)
    await page.evaluate(() => {
      const session = JSON.parse(localStorage.getItem('limitless.session'))
      const expired = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 60 }))
      session.token = `x.${expired}.y`
      localStorage.setItem('limitless.session', JSON.stringify(session))
    })
    await page.goto('/admin/users')
    await expect(page).toHaveURL(/\/login$/)
  })
})

test.describe('UI and navigation', () => {
  test('TC-UI-01/03 (P): splash shows the logo and leads to login', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('img.emblem')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/, { timeout: 8_000 })
    await expect(page.locator('img.emblem')).toBeVisible()
  })

  test('TC-UI-02/04 (P): sidebar logo, username and every nav item work', async ({ page }) => {
    await signInAsAdmin(page)
    await expect(page.locator('.app__logo')).toBeVisible()
    await expect(page.locator('.user-menu__avatar')).toBeVisible()
    for (const [label, path] of [['Users', '/admin/users'], ['Reports', '/admin/reports'], ['Email', '/admin/email'], ['Dashboard', '/admin']]) {
      await page.getByRole('navigation').getByRole('link', { name: label }).click()
      await expect(page).toHaveURL(new RegExp(`${path}$`))
      await expect(page.getByRole('navigation').getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page')
    }
  })

  test('TC-UI-05 (P): back and cancel links return to the right screen', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('link', { name: 'Forgot Password?' }).click()
    await page.getByRole('link', { name: 'Back to Login' }).click()
    await expect(page).toHaveURL(/\/login$/)
    await page.getByRole('link', { name: 'Request Access / Create Account' }).click()
    await page.getByRole('link', { name: 'Back to Sign In' }).click()
    await expect(page).toHaveURL(/\/login$/)

    await signInAsAdmin(page)
    await page.goto('/admin/users/new')
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page).toHaveURL(/\/admin\/users$/)
    await page.goto('/admin/reports/users')
    await page.getByRole('link', { name: '← Back to Reports' }).click()
    await expect(page).toHaveURL(/\/admin\/reports$/)
  })

  test('TC-UI-06 (N): unknown URLs redirect', async ({ page }) => {
    await page.goto('/no-such-page')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('TC-UI-07 (N): an unreachable backend shows a clear message', async ({ page }) => {
    await page.route(/\/api\/auth\//, (route) => route.abort('connectionrefused'))
    await signIn(page, ADMIN.username, ADMIN.password)
    await expect(alert(page)).toHaveText('Unable to reach the server. Please make sure the backend is running.')
  })

  test('TC-UI-08 (P): deep links load on refresh', async ({ page }) => {
    await signInAsAdmin(page)
    await page.goto('/admin/reports/users')
    await page.reload()
    await expect(page.getByRole('heading', { name: 'All Users Report', level: 1 })).toBeVisible()
  })
})
