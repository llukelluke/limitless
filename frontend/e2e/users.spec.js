import { expect, test } from '@playwright/test'
import { alert, createUser, signIn, signInAsAdmin, signOut, uniquePerson } from './helpers.js'

const save = async (page) => {
  await page.getByRole('button', { name: 'Save Changes' }).click()
  await expect(page.getByRole('button', { name: 'Save Changes' })).toBeEnabled()
}

test.describe('User management', () => {
  test('TC-USR-01 (P): admin creates a user and sees the temporary password', async ({ page }) => {
    const person = uniquePerson('Taylor')
    await signInAsAdmin(page)
    await page.goto('/admin/users')
    await page.getByRole('link', { name: 'Add User' }).click()
    await page.getByLabel('FIRST NAME').fill(person.first)
    await page.getByLabel('LAST NAME').fill(person.last)
    await page.getByLabel('EMAIL ADDRESS').fill(person.email)
    await page.getByLabel('DATE OF BIRTH').fill('1998-03-03')
    await page.getByLabel('ADDRESS', { exact: true }).fill('789 Example Road')
    await page.getByLabel('ROLE', { exact: true }).selectOption('ACCOUNTANT')
    await page.getByRole('button', { name: 'Create User' }).click()
    await expect(alert(page)).toContainText('Temporary password')
    const password = await page.locator('.secret').innerText()
    const username = (await alert(page).locator('strong').first().innerText()).trim()

    await signOut(page)
    await signIn(page, username, password)
    await expect(page).toHaveURL(/\/home$/)
  })

  test('TC-USR-02/03 (N): required fields and role are enforced', async ({ page }) => {
    await signInAsAdmin(page)
    await page.goto('/admin/users/new')
    await page.getByRole('button', { name: 'Create User' }).click()
    await expect(alert(page)).toHaveText('First name, last name, email address, and role are required.')
    const person = uniquePerson('NoRole')
    await page.getByLabel('FIRST NAME').fill(person.first)
    await page.getByLabel('LAST NAME').fill(person.last)
    await page.getByLabel('EMAIL ADDRESS').fill(person.email)
    await page.getByRole('button', { name: 'Create User' }).click()
    await expect(alert(page)).toHaveText('First name, last name, email address, and role are required.')
  })

  test('TC-USR-04 (N): duplicate email is rejected', async ({ page, request }) => {
    const person = uniquePerson('Dup')
    await createUser(request, person)
    await signInAsAdmin(page)
    await page.goto('/admin/users/new')
    await page.getByLabel('FIRST NAME').fill('Other')
    await page.getByLabel('LAST NAME').fill('Person')
    await page.getByLabel('EMAIL ADDRESS').fill(person.email)
    await page.getByLabel('ROLE', { exact: true }).selectOption('MANAGER')
    await page.getByRole('button', { name: 'Create User' }).click()
    await expect(alert(page)).toHaveText('A user with this email address already exists.')
  })

  test('TC-USR-05/06/07 (P/N): search and filters narrow the list', async ({ page, request }) => {
    const manager = await createUser(request, uniquePerson('Filter'), 'MANAGER')
    const accountant = await createUser(request, uniquePerson('Filter'), 'ACCOUNTANT')
    await signInAsAdmin(page)
    await page.goto('/admin/users')

    await page.getByLabel('Search users').fill(manager.username)
    await expect(page.getByText(manager.username)).toBeVisible()
    await expect(page.getByText(accountant.username)).toHaveCount(0)

    await page.getByLabel('Search users').fill('filter')
    await page.getByLabel('Filter by role').selectOption('MANAGER')
    await expect(page.getByText(manager.username)).toBeVisible()
    await expect(page.getByText(accountant.username)).toHaveCount(0)

    await page.getByLabel('Search users').fill('zzz-no-such-user')
    await expect(page.getByText('No users match these filters.')).toBeVisible()
  })

  test.describe('editing one user', () => {
    let user

    test.beforeEach(async ({ page, request }) => {
      user = await createUser(request, uniquePerson('Edit'))
      await signInAsAdmin(page)
      await page.goto(`/admin/users/${user.id}`)
      await expect(page.getByLabel('USERNAME')).toHaveValue(user.username)
    })

    test('TC-USR-08/09 (P): address and role changes are saved', async ({ page }) => {
      await page.getByLabel('ADDRESS', { exact: true }).fill('42 Updated Ave')
      await page.getByLabel('ROLE', { exact: true }).selectOption('MANAGER')
      await save(page)
      await expect(alert(page)).toHaveText('Changes saved.')
      await page.reload()
      await expect(page.getByLabel('ADDRESS', { exact: true })).toHaveValue('42 Updated Ave')
      await expect(page.getByLabel('ROLE', { exact: true })).toHaveValue('MANAGER')
    })

    test('TC-USR-10 (N): first name is required', async ({ page }) => {
      await page.getByLabel('FIRST NAME').fill('')
      await save(page)
      await expect(alert(page)).toHaveText('First name, last name, and email address are required.')
    })

    test('TC-USR-11 (N): email taken by another user is rejected', async ({ page }) => {
      await page.getByLabel('EMAIL ADDRESS').fill('admin@limitless.local')
      await save(page)
      await expect(alert(page)).toHaveText('A user with this email address already exists.')
    })

    test('TC-USR-12/13 (P): deactivate blocks login; activate restores it', async ({ page }) => {
      await page.getByLabel('ACCOUNT STATUS').selectOption('DEACTIVATED')
      await save(page)
      await expect(page.getByLabel('ACCOUNT STATUS')).toHaveValue('DEACTIVATED')

      await signOut(page)
      await signIn(page, user.username, user.password)
      await expect(alert(page)).toHaveText('This account is deactivated.')

      await signInAsAdmin(page)
      await page.goto(`/admin/users/${user.id}`)
      await page.getByLabel('ACCOUNT STATUS').selectOption('ACTIVATED')
      await save(page)
      await expect(page.getByLabel('ACCOUNT STATUS')).toHaveValue('ACTIVATED')
      await signOut(page)
      await signIn(page, user.username, user.password)
      await expect(page).toHaveURL(/\/home$/)
    })

    test('TC-USR-14 (P): suspension for a date range blocks login', async ({ page }) => {
      await page.getByLabel('START DATE').fill('2026-01-01')
      await page.getByLabel('EXPIRY DATE').fill('2099-12-31')
      await save(page)
      await expect(page.getByLabel('ACCOUNT STATUS')).toHaveValue('SUSPENDED')
      await signOut(page)
      await signIn(page, user.username, user.password)
      await expect(alert(page)).toHaveText('This account is suspended.')
    })

    test('TC-USR-15 (N): expiry before start is rejected', async ({ page }) => {
      await page.getByLabel('START DATE').fill('2026-11-10')
      await page.getByLabel('EXPIRY DATE').fill('2026-11-01')
      await save(page)
      await expect(alert(page)).toHaveText('Suspension expiry date must be after the start date.')
    })

    test('TC-USR-16 (N): only one suspension date is rejected', async ({ page }) => {
      await page.getByLabel('START DATE').fill('2026-11-10')
      await save(page)
      await expect(alert(page)).toHaveText('Enter both a suspension start date and an expiry date.')
    })

    test('TC-USR-17 (N): Suspended status without dates is rejected', async ({ page }) => {
      await page.getByLabel('ACCOUNT STATUS').selectOption('SUSPENDED')
      await save(page)
      await expect(alert(page)).toHaveText('To suspend this user, choose a suspension start date and expiry date.')
    })

    test('TC-USR-18 (P): username and password fields are read-only', async ({ page }) => {
      await expect(page.getByLabel('USERNAME')).toHaveAttribute('readonly', '')
      await expect(page.getByLabel('PASSWORD STATUS')).toHaveAttribute('readonly', '')
      await expect(page.getByLabel('PASSWORD EXPIRATION')).toHaveAttribute('readonly', '')
    })
  })
})
