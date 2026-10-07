import { expect, test } from '@playwright/test'
import { adminToken, alert, createUser, requestAccess, signInAsAdmin, uniquePerson } from './helpers.js'

test.describe('Reports, dashboard and email', () => {
  test('TC-RPT-01 (P): All Users report lists users with password status', async ({ page, request }) => {
    const user = await createUser(request, uniquePerson('Report'), 'MANAGER')
    await signInAsAdmin(page)
    await page.goto('/admin/reports')
    await page.getByRole('link', { name: 'View Report →' }).first().click()
    await expect(page).toHaveURL(/\/admin\/reports\/users$/)
    const row = page.getByRole('row', { name: new RegExp(user.username) })
    await expect(row).toContainText('Manager')
    await expect(row).toContainText('Valid')
  })

  test('TC-RPT-02/03 (P/N): Expired Passwords report matches the API', async ({ page, request }) => {
    const token = await adminToken(request)
    const expired = await (await request.get('/api/users/reports/expired-passwords', {
      headers: { Authorization: `Bearer ${token}` },
    })).json()
    await signInAsAdmin(page)
    await page.goto('/admin/reports/expired-passwords')
    if (expired.length === 0) {
      await expect(page.getByText('No expired passwords.')).toBeVisible()
    } else {
      await expect(page.locator('tbody tr')).toHaveCount(expired.length)
    }
  })

  test('TC-RPT-04 (P): dashboard counts match the data and cards link to lists', async ({ page, request }) => {
    await requestAccess(request, uniquePerson('Count'))
    const token = await adminToken(request)
    const users = await (await request.get('/api/users', { headers: { Authorization: `Bearer ${token}` } })).json()
    const pending = users.filter((user) => user.status === 'PENDING').length

    await signInAsAdmin(page)
    await expect(page.locator('.stat-card').nth(1).locator('.stat-card__value')).toHaveText(String(pending))
    await page.locator('.stat-card').nth(2).getByRole('link').click()
    await expect(page.getByLabel('Filter by status')).toHaveValue('SUSPENDED')
  })

  test('TC-EML-01 (P): admin sends an email to a user', async ({ page, request }) => {
    const person = uniquePerson('Mail')
    const user = await createUser(request, person)
    await signInAsAdmin(page)
    await page.goto('/admin/email')
    await page.getByLabel('RECIPIENT').selectOption(String(user.id))
    await page.getByLabel('SUBJECT').fill('Welcome')
    await page.getByLabel('MESSAGE').fill('Hello from the end-to-end tests.')
    await page.getByRole('button', { name: 'Send Email' }).click()
    await expect(alert(page)).toHaveText(`Email sent to ${person.email}.`)
    await expect(page.getByLabel('SUBJECT')).toHaveValue('')
  })

  test('TC-EML-02 (N): recipient, subject and message are required', async ({ page }) => {
    await signInAsAdmin(page)
    await page.goto('/admin/email')
    await page.getByRole('button', { name: 'Send Email' }).click()
    await expect(alert(page)).toHaveText('Choose a recipient and enter a subject and message.')
  })
})
