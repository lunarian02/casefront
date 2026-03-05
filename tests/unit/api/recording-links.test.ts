/**
 * tests/unit/api/recording-links.test.ts
 *
 * GET    /api/dashboard/recordings/[id]/links — 링크된 사건 목록
 * POST   /api/dashboard/recordings/[id]/links — 사건 링크 추가
 * DELETE /api/dashboard/recordings/[id]/links — 링크 제거
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
  vi.mocked(supabaseAdmin.auth.getUser).mockResolvedValue({ data: { user }, error: null } as never)
}

function mockAuthFail() {
  vi.mocked(supabaseAdmin.auth.getUser).mockResolvedValue({ data: { user: null }, error: { message: 'invalid token' } } as never)
}

// ── GET ───────────────────────────────────────────────────────────────────────
describe('GET /api/dashboard/recordings/[id]/links', () => {
  beforeEach(() => vi.resetAllMocks())

  it('토큰이 없으면 401을 반환한다', async () => {
    mockAuthFail()
    const { GET } = await import('~app/api/dashboard/recordings/[id]/links/route')
    const req = new Request('http://localhost/api/dashboard/recordings/rec-001/links')
    const params = Promise.resolve({ id: 'rec-001' })
    const res = await GET(req, { params })
    expect(res.status).toBe(401)
  })

  it('링크가 없으면 빈 배열을 반환한다', async () => {
    const firm = mockFirm()
    mockAuth()

    const firmChain = createQueryChain(firm, null)
    const linksChain = createQueryChain([], null)

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(firmChain as never)
      .mockReturnValueOnce(linksChain as never)

    const { GET } = await import('~app/api/dashboard/recordings/[id]/links/route')
    const req = new Request('http://localhost/api/dashboard/recordings/rec-001/links', {
      headers: { Authorization: 'Bearer valid-token' },
    })
    const params = Promise.resolve({ id: 'rec-001' })

    const res = await GET(req, { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.links).toEqual([])
  })

  it('링크된 사건 목록을 반환한다', async () => {
    const firm = mockFirm()
    const links = [
      { id: 'link-001', case_id: 1, case_client_name: '김철수', case_type: '교통사고', created_at: new Date().toISOString(), case_summaries: { session_id: 'sess-001' } },
    ]
    mockAuth()

    const firmChain = createQueryChain(firm, null)
    const linksChain = createQueryChain(links, null)

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(firmChain as never)
      .mockReturnValueOnce(linksChain as never)

    const { GET } = await import('~app/api/dashboard/recordings/[id]/links/route')
    const req = new Request('http://localhost/api/dashboard/recordings/rec-001/links', {
      headers: { Authorization: 'Bearer valid-token' },
    })
    const params = Promise.resolve({ id: 'rec-001' })

    const res = await GET(req, { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.links).toHaveLength(1)
    expect(body.links[0].case_client_name).toBe('김철수')
  })
})

// ── POST ──────────────────────────────────────────────────────────────────────
describe('POST /api/dashboard/recordings/[id]/links', () => {
  beforeEach(() => vi.resetAllMocks())

  it('토큰이 없으면 401을 반환한다', async () => {
    mockAuthFail()
    const { POST } = await import('~app/api/dashboard/recordings/[id]/links/route')
    const req = new Request('http://localhost/api/dashboard/recordings/rec-001/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ case_id: 1 }),
    })
    const params = Promise.resolve({ id: 'rec-001' })
    const res = await POST(req, { params })
    expect(res.status).toBe(401)
  })

  it('case_id가 없으면 400을 반환한다', async () => {
    const firm = mockFirm()
    mockAuth()

    const firmChain = createQueryChain(firm, null)
    vi.mocked(supabaseAdmin.from).mockReturnValue(firmChain as never)

    const { POST } = await import('~app/api/dashboard/recordings/[id]/links/route')
    const req = new Request('http://localhost/api/dashboard/recordings/rec-001/links', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ case_type: '교통사고' }), // case_id 없음
    })
    const params = Promise.resolve({ id: 'rec-001' })

    const res = await POST(req, { params })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('case_id')
  })

  it('링크 생성 시 201과 link를 반환한다', async () => {
    const firm = mockFirm()
    const link = { id: 'link-001', recording_id: 'rec-001', case_id: 1 }
    mockAuth()

    const firmChain = createQueryChain(firm, null)
    const insertChain = createQueryChain(link, null)

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(firmChain as never)
      .mockReturnValueOnce(insertChain as never)

    const { POST } = await import('~app/api/dashboard/recordings/[id]/links/route')
    const req = new Request('http://localhost/api/dashboard/recordings/rec-001/links', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ case_id: 1, case_client_name: '김철수', case_type: '교통사고' }),
    })
    const params = Promise.resolve({ id: 'rec-001' })

    const res = await POST(req, { params })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.link.case_id).toBe(1)
  })

  it('이미 연결된 사건은 409를 반환한다', async () => {
    const firm = mockFirm()
    mockAuth()

    const firmChain = createQueryChain(firm, null)
    const insertChain = createQueryChain(null, { code: '23505', message: 'unique violation' })

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(firmChain as never)
      .mockReturnValueOnce(insertChain as never)

    const { POST } = await import('~app/api/dashboard/recordings/[id]/links/route')
    const req = new Request('http://localhost/api/dashboard/recordings/rec-001/links', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ case_id: 1 }),
    })
    const params = Promise.resolve({ id: 'rec-001' })

    const res = await POST(req, { params })
    expect(res.status).toBe(409)
  })
})

// ── DELETE ────────────────────────────────────────────────────────────────────
describe('DELETE /api/dashboard/recordings/[id]/links', () => {
  beforeEach(() => vi.resetAllMocks())

  it('linkId가 없으면 400을 반환한다', async () => {
    const firm = mockFirm()
    mockAuth()

    const firmChain = createQueryChain(firm, null)
    vi.mocked(supabaseAdmin.from).mockReturnValue(firmChain as never)

    const { DELETE } = await import('~app/api/dashboard/recordings/[id]/links/route')
    const req = new Request('http://localhost/api/dashboard/recordings/rec-001/links', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer valid-token' },
      // linkId 쿼리 파라미터 없음
    })
    const params = Promise.resolve({ id: 'rec-001' })

    const res = await DELETE(req, { params })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('linkId')
  })

  it('linkId가 있으면 204를 반환한다', async () => {
    const firm = mockFirm()
    mockAuth()

    const firmChain = createQueryChain(firm, null)
    const deleteChain = createQueryChain(null, null)

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(firmChain as never)
      .mockReturnValueOnce(deleteChain as never)

    const { DELETE } = await import('~app/api/dashboard/recordings/[id]/links/route')
    const req = new Request('http://localhost/api/dashboard/recordings/rec-001/links?linkId=link-001', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer valid-token' },
    })
    const params = Promise.resolve({ id: 'rec-001' })

    const res = await DELETE(req, { params })
    expect(res.status).toBe(204)
  })
})
