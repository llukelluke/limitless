import { expect, test } from '@playwright/test'
import { alert, approvedUser, createUser, setPassword, signIn, signInAsAdmin, signOut, uniquePerson } from './helpers.js'

test.describe('Login and account lockout', () => {
  test('TC-LOGIN-01 (P): administrator signs in to the dashboard with username shown', async ({ page }) => {
    await signInAsAdmin(page)
    await expect(page.getByRole('heading', { name: 'Administrator Dashboard' })).toBeVisible()
    await expect(page.locator('.user-menu__name')).not.toBeEmpty()
  })

  test('TC-LOGIN-02 (P): manager signs in to the home page without admin menu', async ({ page, request }) => {
    const person = uniquePerson('Morgan')
    const user = await createUser(request, person, 'MANAGER')
    await signIn(page, user.username, user.password)
    await expect(page).toHaveURL(/\/home$/)
    await expect(page.locator('.user-menu__name')).toHaveText(user.username)
    await expect(page.getByRole('link', { name: 'Users' })).toHaveCount(0)
  })

  test('TC-LOGIN-03 (P): eye icon shows and hides the password', async ({ page }) => {
    await page.goto('/login')
    const password = page.getByLabel('Password', { exact: true })
    await password.fill('secret')
    await page.getByRole('button', { name: 'Show password' }).click()
    await expect(password).toHaveAttribute('type', 'text')
    await page.getByRole('button', { name: 'Hide password' }).click()
    await expect(password).toHaveAttribute('type', 'password')
  })

  test('TC-LOGIN-04 (N): empty form is rejected', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(alert(page)).toHaveText('Please enter your username and password.')
  })

  test('TC-LOGIN-05 (N): wrong password is rejected', async ({ page }) => {
    await signIn(page, 'sadmin1026', 'Wrong123!')
    await expect(alert(page)).toHaveText('Invalid username or password.')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('TC-LOGIN-06 (N): unknown username gets the same message', async ({ page }) => {
    await signIn(page, 'nobody9999', 'Whatever1!')
    await expect(alert(page)).toHaveText('Invalid username or password.')
  })

  test('TC-LOGIN-07 (N): three wrong passwords suspend the account', async ({ page, request }) => {
    const person = uniquePerson('Lock')
    const user = await createUser(request, person)
    for (let attempt = 0; attempt < 3; attempt++) {
      await signIn(page, user.username, 'Wrong123!')
      await expect(alert(page)).toHaveText('Invalid username or password.')
    }
    await signIn(page, user.username, user.password)
    await expect(alert(page)).toHaveText('This account is suspended.')
  })

  test('TC-LOGIN-08 (P): a correct login resets the failed-attempt count', async ({ page, request }) => {
    const person = uniquePerson('Reset')
    const user = await approvedUser(request, person)
    const password = await setPassword(request, user, person.email)
    for (let attempt = 0; attempt < 2; attempt++) {
      await signIn(page, user.username, 'Wrong123!')
      await expect(alert(page)).toBeVisible()
    }
    await signIn(page, user.username, password)
    await expect(page).toHaveURL(/\/home$/)
    await signOut(page)
    // Two more failures would suspend only if the counter had not been reset
    for (let attempt = 0; attempt < 2; attempt++) {
      await signIn(page, user.username, 'Wrong123!')
      await expect(alert(page)).toHaveText('Invalid username or password.')
    }
    await signIn(page, user.username, password)
    await expect(page).toHaveURL(/\/home$/)
  })

  test('TC-LOGIN-13 (P): sign out returns to login and protects admin pages', async ({ page }) => {
    await signInAsAdmin(page)
    await signOut(page)
    await page.goto('/admin/users')
    await expect(page).toHaveURL(/\/login$/)
  })
})
