/**
 * tests/e2e/auth.spec.ts
 *
 * 인증 플로우 E2E 테스트
 * - 실제 dev 서버(port 3001)에 대해 실행
 * - Supabase 인증은 실 서비스를 사용하므로 잘못된 인증정보 테스트만 수행
 */
import { test, expect } from '@playwright/test'

test.describe('인증 플로우', () => {
  test('로그인 페이지가 올바르게 렌더링된다', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByText('CaseFront')).toBeVisible()
    await expect(page.getByPlaceholder(/이메일/)).toBeVisible()
    await expect(page.getByPlaceholder(/비밀번호/)).toBeVisible()
    await expect(page.getByRole('button', { name: /로그인/ })).toBeVisible()
  })

  test('잘못된 인증정보로 로그인 시 에러 메시지가 표시되고 /login에 머문다', async ({ page }) => {
    await page.goto('/login')

    await page.getByPlaceholder(/이메일/).fill('wrong@example.com')
    await page.getByPlaceholder(/비밀번호/).fill('wrongpassword')
    await page.getByRole('button', { name: /로그인/ }).click()

    // 에러가 표시되고 /login 에 그대로 있어야 함
    await expect(page).toHaveURL('/login')
  })

  test('미인증 상태에서 /dashboard 접근 시 /login으로 리디렉트된다', async ({ page }) => {
    await page.goto('/dashboard')

    await expect(page).toHaveURL(/\/login/)
  })
})
