import { expect, test } from '@playwright/test'
import { ADMIN, alert, approvedUser, createUser, evidence, setPassword, signIn, signInAsAdmin, signOut, uniquePerson } from './helpers.js'

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

  test('TC-LOGIN-04 (N): empty form is rejected, with the error next to each field', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Sign In' }).click()
    const errors = page.locator('.auth-field__error')
    await expect(errors).toHaveText(['Enter your username.', 'Enter your password.'])
    await expect(errors.first()).toHaveCSS('color', 'rgb(255, 179, 170)')
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('aria-invalid', 'true')
    // Filling the username leaves only the password error
    await page.getByLabel('Username', { exact: true }).fill(ADMIN.username)
    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(errors).toHaveText(['Enter your password.'])
    await evidence(page, 'L04')
  })

  test('TC-LOGIN-11 (N): the server refuses an empty password without counting a failed attempt', async ({ request }) => {
    for (let i = 0; i < 4; i++) {
      const response = await request.post('/api/auth/login', { data: { username: ADMIN.username, password: '' } })
      expect(response.status()).toBe(400)
      expect((await response.json()).message).toBe('Please enter your username and password.')
    }
    // Four empty tries would have suspended the account if they counted; the real password still works
    expect((await request.post('/api/auth/login', { data: ADMIN })).ok()).toBeTruthy()
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

  test('TC-LOGIN-14 (P): Clear empties the username and password', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Username').fill('someone')
    await page.getByLabel('Password', { exact: true }).fill('secret')
    await page.getByRole('button', { name: 'Clear' }).click()
    await expect(page.getByLabel('Username')).toHaveValue('')
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('')
  })

  test('TC-LOGIN-13 (P): sign out returns to login and protects admin pages', async ({ page }) => {
    await signInAsAdmin(page)
    await signOut(page)
    await page.goto('/admin/users')
    await expect(page).toHaveURL(/\/login$/)
  })
})
