/**
 * tests/unit/api/onboarding.test.ts
 *
 * GET   /api/dashboard/onboarding — 펌 존재 여부 확인
 * POST  /api/dashboard/onboarding — 신규 펌 생성
 * PATCH /api/dashboard/onboarding — 펌 정보 업데이트
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createQueryChain, mockFirm } from '../helpers/supabase-mock'

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
    storage: { from: vi.fn() },
  },
}))

import { supabaseAdmin } from '@/lib/supabase'

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
describe('GET /api/dashboard/onboarding', () => {
  beforeEach(() => vi.resetAllMocks())

  it('토큰이 없으면 401을 반환한다', async () => {
    mockAuthFail()
    const { GET } = await import('~app/api/dashboard/onboarding/route')
    const res = await GET(new Request('http://localhost/api/dashboard/onboarding'))
    expect(res.status).toBe(401)
  })

  it('펌이 없으면 firm: null을 반환한다', async () => {
    mockAuth()
    const chain = createQueryChain(null, null)
    vi.mocked(supabaseAdmin.from).mockReturnValue(chain as never)

    const { GET } = await import('~app/api/dashboard/onboarding/route')
    const req = new Request('http://localhost/api/dashboard/onboarding', {
      headers: { Authorization: 'Bearer valid-token' },
    })

    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.firm).toBeNull()
  })

  it('펌이 있으면 firm 정보를 반환한다', async () => {
    const firm = mockFirm()
    mockAuth()
    const chain = createQueryChain(firm, null)
    vi.mocked(supabaseAdmin.from).mockReturnValue(chain as never)

    const { GET } = await import('~app/api/dashboard/onboarding/route')
    const req = new Request('http://localhost/api/dashboard/onboarding', {
      headers: { Authorization: 'Bearer valid-token' },
    })

    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.firm.id).toBe('firm-abc')
  })
})

// ── POST ──────────────────────────────────────────────────────────────────────
describe('POST /api/dashboard/onboarding', () => {
  beforeEach(() => vi.resetAllMocks())

  it('토큰이 없으면 401을 반환한다', async () => {
    mockAuthFail()
    const { POST } = await import('~app/api/dashboard/onboarding/route')
    const req = new Request('http://localhost/api/dashboard/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '한빛', lawyer_name: '홍길동' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('이미 펌이 존재하면 409를 반환한다', async () => {
    mockAuth()
    const existingFirmChain = createQueryChain({ id: 'existing-firm' }, null)
    vi.mocked(supabaseAdmin.from).mockReturnValue(existingFirmChain as never)

    const { POST } = await import('~app/api/dashboard/onboarding/route')
    const req = new Request('http://localhost/api/dashboard/onboarding', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '한빛', lawyer_name: '홍길동' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain('이미 사무소')
  })

  it('name이나 lawyer_name이 없으면 400을 반환한다', async () => {
    mockAuth()
    const noFirmChain = createQueryChain(null, null)
    vi.mocked(supabaseAdmin.from).mockReturnValue(noFirmChain as never)

    const { POST } = await import('~app/api/dashboard/onboarding/route')
    const req = new Request('http://localhost/api/dashboard/onboarding', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '한빛' }), // lawyer_name 없음
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('유효한 요청이면 201과 firm을 반환한다', async () => {
    const firm = mockFirm()
    mockAuth()

    // existing firm check → null
    const noFirmChain = createQueryChain(null, null)
    // insert → firm
    const insertChain = createQueryChain(firm, null)

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(noFirmChain as never) // existing check
      .mockReturnValueOnce(insertChain as never)  // insert

    const { POST } = await import('~app/api/dashboard/onboarding/route')
    const req = new Request('http://localhost/api/dashboard/onboarding', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '한빛법률사무소', lawyer_name: '홍길동', phone: '02-1234-5678' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.firm).toBeDefined()
  })
})

// ── PATCH ─────────────────────────────────────────────────────────────────────
describe('PATCH /api/dashboard/onboarding', () => {
  beforeEach(() => vi.resetAllMocks())

  it('토큰이 없으면 401을 반환한다', async () => {
    mockAuthFail()
    const { PATCH } = await import('~app/api/dashboard/onboarding/route')
    const req = new Request('http://localhost/api/dashboard/onboarding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '새 사무소' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(401)
  })

  it('펌이 없으면 404를 반환한다', async () => {
    mockAuth()
    const noFirmChain = createQueryChain(null, null)
    vi.mocked(supabaseAdmin.from).mockReturnValue(noFirmChain as never)

    const { PATCH } = await import('~app/api/dashboard/onboarding/route')
    const req = new Request('http://localhost/api/dashboard/onboarding', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '새 사무소' }),
    })

    const res = await PATCH(req)
    expect(res.status).toBe(404)
  })

  it('허용되지 않은 필드만 있으면 400을 반환한다', async () => {
    mockAuth()
    const firmChain = createQueryChain({ id: 'firm-abc' }, null)
    vi.mocked(supabaseAdmin.from).mockReturnValue(firmChain as never)

    const { PATCH } = await import('~app/api/dashboard/onboarding/route')
    const req = new Request('http://localhost/api/dashboard/onboarding', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ unknown_field: 'value' }),
    })

    const res = await PATCH(req)
    expect(res.status).toBe(400)
  })

  it('허용된 필드로 업데이트하면 200과 updated firm을 반환한다', async () => {
    const firm = mockFirm()
    const updatedFirm = { ...firm, name: '새 사무소명' }
    mockAuth()

    const firmChain = createQueryChain({ id: 'firm-abc' }, null)
    const updateChain = createQueryChain(updatedFirm, null)

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(firmChain as never)  // firm lookup
      .mockReturnValueOnce(updateChain as never) // update

    const { PATCH } = await import('~app/api/dashboard/onboarding/route')
    const req = new Request('http://localhost/api/dashboard/onboarding', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '새 사무소명', greeting: '안녕하세요!' }),
    })

    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.firm.name).toBe('새 사무소명')
  })
})
