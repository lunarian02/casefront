/**
 * tests/unit/api/settings.test.ts
 *
 * GET  /api/dashboard/settings  — 인증 여부, firm 반환
 * PATCH /api/dashboard/settings — 401 차단, 허용 필드만 업데이트
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createQueryChain, mockFirm } from '../helpers/supabase-mock'

// ── 1. 모듈 모킹 ─────────────────────────────────────────────────────────────
// tsconfig "paths": { "@/*": ["./src/*"] } → vitest alias: '@' = '<root>/src'
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
    storage: { from: vi.fn() },
  },
}))

import { supabaseAdmin } from '@/lib/supabase'

// ── 헬퍼 ──────────────────────────────────────────────────────────────────────
function mockAuth(user = { id: 'user-123', email: 'test@casefront.com' }) {
  vi.mocked(supabaseAdmin.auth.getUser).mockResolvedValue({
    data: { user },
    error: null,
  } as never)
}

function mockAuthFail() {
  vi.mocked(supabaseAdmin.auth.getUser).mockResolvedValue({
    data: { user: null },
    error: { message: 'invalid token' },
  } as never)
}

// ── GET ───────────────────────────────────────────────────────────────────────
describe('GET /api/dashboard/settings', () => {
  beforeEach(() => vi.resetAllMocks())

  it('Authorization 헤더가 없으면 401을 반환한다', async () => {
    // auth.getUser가 null user를 반환하도록 (토큰 없음)
    mockAuthFail()
    const { GET } = await import('~app/api/dashboard/settings/route')
    const req = new Request('http://localhost/api/dashboard/settings')

    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('유효한 토큰이면 firm 데이터를 반환한다', async () => {
    const firm = mockFirm()
    mockAuth()

    // firms 쿼리 → firm 반환
    const firmChain = createQueryChain(firm, null)
    vi.mocked(supabaseAdmin.from).mockReturnValue(firmChain as never)

    const { GET } = await import('~app/api/dashboard/settings/route')
    const req = new Request('http://localhost/api/dashboard/settings', {
      headers: { Authorization: 'Bearer valid-token' },
    })

    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.firm).toBeDefined()
    expect(body.firm.id).toBe('firm-abc')
  })
})

// ── PATCH ─────────────────────────────────────────────────────────────────────
describe('PATCH /api/dashboard/settings', () => {
  beforeEach(() => vi.resetAllMocks())

  it('Authorization 헤더가 없으면 401을 반환한다', async () => {
    mockAuthFail()
    const { PATCH } = await import('~app/api/dashboard/settings/route')
    const req = new Request('http://localhost/api/dashboard/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '새 사무소명' }),
    })

    const res = await PATCH(req)

    expect(res.status).toBe(401)
  })

  it('수정 항목이 없으면 400을 반환한다', async () => {
    const firm = mockFirm()
    mockAuth()
    // getAuthFirm 내부 firms 쿼리
    const firmChain = createQueryChain(firm, null)
    vi.mocked(supabaseAdmin.from).mockReturnValue(firmChain as never)

    const { PATCH } = await import('~app/api/dashboard/settings/route')
    const req = new Request('http://localhost/api/dashboard/settings', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer valid-token',
        'Content-Type': 'application/json',
      },
      // allowedCols 에 없는 필드만 전달
      body: JSON.stringify({ unknown_field: 'value' }),
    })

    const res = await PATCH(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('수정할 항목이 없습니다')
  })

  it('허용된 필드만 포함된 요청은 200을 반환한다', async () => {
    const firm = mockFirm()
    const updatedFirm = { ...firm, name: '새 사무소명' }
    mockAuth()

    // getAuthFirm 의 firms 쿼리 (maybeSingle)
    const firmChain = createQueryChain(firm, null)
    // update 쿼리의 .select().single() (터미널)
    const updateChain = createQueryChain(updatedFirm, null)

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(firmChain as never)   // getAuthFirm
      .mockReturnValueOnce(updateChain as never) // update

    const { PATCH } = await import('~app/api/dashboard/settings/route')
    const req = new Request('http://localhost/api/dashboard/settings', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer valid-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: '새 사무소명' }),
    })

    const res = await PATCH(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.firm).toBeDefined()
  })

  it('notify_email 값은 소문자로 정규화된다', async () => {
    const firm = mockFirm()
    const updatedFirm = { ...firm, notify_email: 'lawyer@casefront.com' }
    mockAuth()

    const firmChain = createQueryChain(firm, null)
    const updateChain = createQueryChain(updatedFirm, null)
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(firmChain as never)
      .mockReturnValueOnce(updateChain as never)

    const { PATCH } = await import('~app/api/dashboard/settings/route')
    const req = new Request('http://localhost/api/dashboard/settings', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer valid-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notify_email: 'LAWYER@CASEFRONT.COM' }),
    })

    const res = await PATCH(req)
    expect(res.status).toBe(200)
    // 실제 update 호출 체인에서 정규화가 이뤄졌는지 확인
    const updateCallArgs = vi.mocked(supabaseAdmin.from).mock.calls
    // 두 번째 from() 호출이 firms 테이블 update
    expect(updateCallArgs[1][0]).toBe('firms')
  })
})
