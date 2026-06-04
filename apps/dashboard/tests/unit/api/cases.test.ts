/**
 * tests/unit/api/cases.test.ts
 *
 * GET /api/dashboard/cases — 인증, 사건 목록, 빈 목록 (페이지네이션)
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
describe('GET /api/dashboard/cases', () => {
  beforeEach(() => vi.resetAllMocks())

  it('Authorization 헤더가 없으면 401을 반환한다', async () => {
    mockAuthFail()
    const { GET } = await import('~app/api/dashboard/cases/route')
    const req = new Request('http://localhost/api/dashboard/cases')

    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toHaveProperty('error')
  })

  it('사건이 없는 firm은 빈 배열을 반환한다', async () => {
    const firm = mockFirm()
    mockAuth()

    const firmChain  = createQueryChain(firm, null)
    const countChain = createQueryChain(null, null)  // Promise.all count query
    const casesChain = createQueryChain([], null)

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(firmChain as never)
      .mockReturnValueOnce(countChain as never)
      .mockReturnValueOnce(casesChain as never)

    const { GET } = await import('~app/api/dashboard/cases/route')
    const req = new Request('http://localhost/api/dashboard/cases', {
      headers: { Authorization: 'Bearer valid-token' },
    })

    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.cases).toEqual([])
  })

  it('사건 목록을 반환한다', async () => {
    const firm = mockFirm()
    const rawCases = [
      {
        id: 'case-001',
        session_id: 'sess-001',
        client_name: '김철수',
        client_phone: '010-1111-2222',
        case_type: '교통사고',
        status: 'new',
        created_at: new Date().toISOString(),
      },
      {
        id: 'case-002',
        session_id: 'sess-002',
        client_name: '이영희',
        client_phone: '010-3333-4444',
        case_type: '형사',
        status: 'reviewing',
        created_at: new Date().toISOString(),
      },
    ]
    mockAuth()

    const firmChain  = createQueryChain(firm, null)
    const countChain = createQueryChain(null, null)  // Promise.all count query
    const casesChain = createQueryChain(rawCases, null)

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(firmChain as never)
      .mockReturnValueOnce(countChain as never)
      .mockReturnValueOnce(casesChain as never)

    const { GET } = await import('~app/api/dashboard/cases/route')
    const req = new Request('http://localhost/api/dashboard/cases', {
      headers: { Authorization: 'Bearer valid-token' },
    })

    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.cases).toHaveLength(2)
    expect(body.cases[0].client_name).toBe('김철수')
    expect(body.cases[1].case_type).toBe('형사')
  })

  it('firm이 존재하지 않으면 404를 반환한다', async () => {
    mockAuth()

    // getAuthUser 성공, firms 쿼리 결과가 null
    const firmChain = createQueryChain(null, null)
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(firmChain as never)

    const { GET } = await import('~app/api/dashboard/cases/route')
    const req = new Request('http://localhost/api/dashboard/cases', {
      headers: { Authorization: 'Bearer valid-token' },
    })

    const res = await GET(req)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Firm not found')
  })
})
