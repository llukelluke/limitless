import { expect, test } from '@playwright/test'
import { ANSWERS, approvedUser, setPassword, signIn, uniquePerson } from './helpers.js'

// The verification steps (06–07) are the teammate's ForgotPassword page; 08–09 are the shared reset screens.
async function verifyIdentity(page, username, email, answers = ANSWERS) {
  await page.goto('/login')
  await page.getByRole('link', { name: 'Forgot Password?' }).click()
  await page.getByLabel('Email Address').fill(email)
  await page.getByRole('button', { name: 'Send Reset Link' }).click()
  await page.getByLabel('Username').fill(username)
  for (let index = 0; index < 3; index++) {
    await page.getByLabel(`Security Answer ${index + 1}`).fill(answers[index])
  }
  await page.getByRole('button', { name: 'Verify Information' }).click()
}

async function submitNewPassword(page, password, confirm = password) {
  await page.getByLabel('New password').fill(password)
  await page.getByLabel('Confirm password').fill(confirm)
  await page.getByRole('button', { name: 'Reset Password' }).click()
}

const error = (page) => page.locator('.alert, .forgot-password-error').first()

test.describe('Forgot and reset password', () => {
  let person
  let user

  test.beforeEach(async ({ request }) => {
    person = uniquePerson('Pat')
    user = await approvedUser(request, person)
  })

  test('TC-PW-01/14 (P): verify identity, set a new password, sign in with it', async ({ page }) => {
    await verifyIdentity(page, user.username, person.email)
    await expect(page).toHaveURL(/\/forgot-password\/reset$/)
    await submitNewPassword(page, 'Newpass1!')
    await expect(page).toHaveURL(/\/forgot-password\/done$/)
    await signIn(page, user.username, 'Newpass1!')
    await expect(page).toHaveURL(/\/home$/)
  })

  test('TC-PW-02 (P): answers ignore capitals and extra spaces', async ({ page }) => {
    await verifyIdentity(page, user.username, person.email, [' LINCOLN ', 'Atlanta', 'HONDA'])
    await expect(page).toHaveURL(/\/forgot-password\/reset$/)
  })

  test('TC-PW-03 (N): email is required on the first step', async ({ page }) => {
    await page.goto('/forgot-password')
    await page.getByRole('button', { name: 'Send Reset Link' }).click()
    await expect(error(page)).toHaveText('Please enter your email address.')
  })

  test('TC-PW-04 (N): all verification fields are required', async ({ page }) => {
    await page.goto('/forgot-password')
    await page.getByLabel('Email Address').fill(person.email)
    await page.getByRole('button', { name: 'Send Reset Link' }).click()
    await page.getByRole('button', { name: 'Verify Information' }).click()
    await expect(error(page)).toHaveText('Please complete all fields.')
  })

  test('TC-PW-05 (N): a wrong answer is rejected', async ({ page }) => {
    await verifyIdentity(page, user.username, person.email, ['wrong', ANSWERS[1], ANSWERS[2]])
    await expect(error(page)).toHaveText('The information provided does not match our records.')
  })

  test('TC-PW-06 (N): email of a different account is rejected with the same message', async ({ page }) => {
    await verifyIdentity(page, user.username, 'someone.else@e2e.example')
    await expect(error(page)).toHaveText('The information provided does not match our records.')
  })

  for (const [id, password, message] of [
    ['TC-PW-07', 'short', 'be at least 8 characters'],
    ['TC-PW-08', '1password!', 'start with a letter'],
    ['TC-PW-09', 'Password1', 'include a special character'],
    ['TC-PW-10', 'Password!', 'include a number'],
  ]) {
    test(`${id} (N): "${password}" is rejected by the password rules`, async ({ page }) => {
      await verifyIdentity(page, user.username, person.email)
      await submitNewPassword(page, password)
      await expect(error(page)).toContainText(message)
    })
  }

  test('TC-PW-11 (N): passwords that do not match are rejected', async ({ page }) => {
    await verifyIdentity(page, user.username, person.email)
    await submitNewPassword(page, 'Newpass1!', 'Newpass2!')
    await expect(error(page)).toHaveText('The passwords do not match.')
  })

  test('TC-PW-12 (N): the current password cannot be reused', async ({ page, request }) => {
    const current = await setPassword(request, user, person.email, 'Current1!')
    await verifyIdentity(page, user.username, person.email)
    await submitNewPassword(page, current)
    await expect(error(page)).toContainText('This password has been used before')
  })

  test('TC-PW-13 (N): an older password cannot be reused', async ({ page, request }) => {
    await setPassword(request, user, person.email, 'Older123!')
    await setPassword(request, user, person.email, 'Current1!')
    await verifyIdentity(page, user.username, person.email)
    await submitNewPassword(page, 'Older123!')
    await expect(error(page)).toContainText('This password has been used before')
  })

  test('TC-PW-15 (N): a reset token works only once', async ({ request }) => {
    const forgot = await request.post('/api/auth/forgot-password', {
      data: {
        username: user.username,
        email_address: person.email,
        security_answer1: ANSWERS[0],
        security_answer2: ANSWERS[1],
        security_answer3: ANSWERS[2],
      },
    })
    const { reset_token } = await forgot.json()
    expect((await request.post('/api/auth/reset-password', { data: { reset_token, new_password: 'First123!' } })).ok()).toBeTruthy()
    const again = await request.post('/api/auth/reset-password', { data: { reset_token, new_password: 'Second12!' } })
    expect(again.status()).toBe(401)
    expect((await again.json()).message).toBe('This reset link is invalid or has expired.')
  })

  test('TC-PW-16 (N): the reset screen cannot be opened directly', async ({ page }) => {
    await page.goto('/forgot-password/reset')
    await expect(page).toHaveURL(/\/forgot-password$/)
  })
})
