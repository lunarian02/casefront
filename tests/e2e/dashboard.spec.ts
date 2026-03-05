/**
 * tests/e2e/dashboard.spec.ts
 *
 * 대시보드 페이지 접근 권한 E2E 테스트
 * - 미인증 상태에서 보호 경로 접근 시 /login 리디렉트 확인
 */
import { test, expect } from '@playwright/test'

test.describe('대시보드 — 미인증 접근 차단', () => {
  test('/dashboard 접근 시 /login으로 리디렉트된다', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('상담 기록 목록 — 미인증 접근 차단', () => {
  test('/dashboard/recordings 접근 시 /login으로 리디렉트된다', async ({ page }) => {
    await page.goto('/dashboard/recordings')
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('설정 페이지 — 미인증 접근 차단', () => {
  test('/dashboard/settings 접근 시 /login으로 리디렉트된다', async ({ page }) => {
    await page.goto('/dashboard/settings')
    await expect(page).toHaveURL(/\/login/)
  })
})
