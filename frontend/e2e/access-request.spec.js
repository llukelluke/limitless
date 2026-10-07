import { expect, test } from '@playwright/test'
import { alert, adminToken, requestAccess, signIn, signInAsAdmin, uniquePerson } from './helpers.js'

async function fillRequestForm(page, person) {
  await page.getByLabel('First name', { exact: true }).fill(person.first)
  await page.getByLabel('Last name', { exact: true }).fill(person.last)
  await page.getByLabel('Email address', { exact: true }).fill(person.email)
  await page.getByLabel('Address', { exact: true }).fill('123 Example Street')
  await page.getByLabel('Date of birth', { exact: true }).fill('2000-01-01')
  await page.getByLabel('Security question 1').fill('lincoln')
  await page.getByLabel('Security question 2').fill('atlanta')
  await page.getByLabel('Security question 3').fill('honda')
}

test.describe('Request access and approval', () => {
  test('TC-REQ-01 (P): a new user submits an access request', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('link', { name: 'Request Access / Create Account' }).click()
    await fillRequestForm(page, uniquePerson('Jordan'))
    await page.getByRole('button', { name: 'Submit Request' }).click()
    await expect(page).toHaveURL(/\/request-access\/submitted$/)
    await expect(page.getByRole('heading', { name: 'Request Submitted' })).toBeVisible()
  })

  test('TC-REQ-02 (N): empty form is rejected', async ({ page }) => {
    await page.goto('/request-access')
    await page.getByRole('button', { name: 'Submit Request' }).click()
    await expect(alert(page)).toContainText('Please fill in your first name')
  })

  test('TC-REQ-03 (N): a missing security answer is rejected', async ({ page }) => {
    await page.goto('/request-access')
    await fillRequestForm(page, uniquePerson('Ana'))
    await page.getByLabel('Security question 2').fill('')
    await page.getByRole('button', { name: 'Submit Request' }).click()
    await expect(alert(page)).toContainText('Please answer all three security questions')
  })

  test('TC-REQ-04 (N): an email that is already registered is rejected', async ({ page, request }) => {
    const person = uniquePerson('Dup')
    await requestAccess(request, person)
    await page.goto('/request-access')
    await fillRequestForm(page, person)
    await page.getByRole('button', { name: 'Submit Request' }).click()
    await expect(alert(page)).toHaveText('A user with this email address already exists.')
  })

  test('TC-REQ-05/06 (P): admin approves with a role; username follows the format', async ({ page, request }) => {
    const person = uniquePerson('Jordan')
    const id = await requestAccess(request, person)
    await signInAsAdmin(page)
    await page.goto(`/admin/access-requests/${id}`)
    await expect(page.getByLabel('EMAIL ADDRESS')).toHaveValue(person.email)
    await page.getByLabel('ROLE IF APPROVED').selectOption('MANAGER')
    await page.getByRole('button', { name: 'Approve' }).click()

    const now = new Date()
    const mmyy = `${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getFullYear() % 100).padStart(2, '0')}`
    const expected = `${person.first[0]}${person.last}${mmyy}`.toLowerCase()
    await expect(alert(page)).toContainText(`Approved. Username ${expected}`)
  })

  test('TC-REQ-08 (P): admin rejects a request and it leaves the pending list', async ({ page, request }) => {
    const person = uniquePerson('Sam')
    const id = await requestAccess(request, person)
    await signInAsAdmin(page)
    await page.goto(`/admin/access-requests/${id}`)
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Reject' }).click()
    await expect(alert(page)).toContainText('Request rejected')
    await page.goto('/admin/access-requests')
    await expect(page.getByText(person.email)).toHaveCount(0)
  })

  test('TC-REQ-09 (N): an approved request cannot be approved again', async ({ page, request }) => {
    const id = await requestAccess(request, uniquePerson('Twice'))
    const token = await adminToken(request)
    const headers = { Authorization: `Bearer ${token}` }
    expect((await request.put(`/api/auth/access-requests/${id}/approve`, { headers })).ok()).toBeTruthy()
    const again = await request.put(`/api/auth/access-requests/${id}/approve`, { headers })
    expect(again.status()).toBe(404)

    await signInAsAdmin(page)
    await page.goto(`/admin/access-requests/${id}`)
    await expect(page).toHaveURL(new RegExp(`/admin/users/${id}$`))
  })

  test('TC-LOGIN-10 (N): a pending applicant cannot sign in', async ({ page, request }) => {
    const person = uniquePerson('Wait')
    await requestAccess(request, person)
    await signIn(page, person.email, 'Anything1!')
    await expect(alert(page)).toHaveText('Invalid username or password.')
  })
})
