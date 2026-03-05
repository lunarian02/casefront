/**
 * tests/unit/api/clients.test.ts
 *
 * POST /api/dashboard/clients          — 고객 생성
 * GET  /api/dashboard/clients          — 고객 목록
 * GET  /api/dashboard/clients/[id]     — 고객 상세
 * PATCH /api/dashboard/clients/[id]    — 고객 수정
 * DELETE /api/dashboard/clients/[id]   — 고객 삭제
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

function mockClient(overrides: Record<string, unknown> = {}) {
  return {
    id: 'client-001',
    firm_id: 'firm-abc',
    name: '김철수',
    phone: '010-1234-5678',
    email: 'kim@example.com',
    created_at: new Date().toISOString(),
    last_contact_at: new Date().toISOString(),
    ...overrides,
  }
}

// ── POST /api/dashboard/clients ───────────────────────────────────────────────
describe('POST /api/dashboard/clients', () => {
  beforeEach(() => vi.resetAllMocks())

  it('토큰이 없으면 401을 반환한다', async () => {
    mockAuthFail()
    const { POST } = await import('~app/api/dashboard/clients/route')
    const req = new Request('http://localhost/api/dashboard/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '김철수', phone: '01012345678' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('name이나 phone이 없으면 400을 반환한다', async () => {
    const firm = mockFirm()
    mockAuth()

    const firmChain = createQueryChain(firm, null)
    vi.mocked(supabaseAdmin.from).mockReturnValue(firmChain as never)

    const { POST } = await import('~app/api/dashboard/clients/route')
    const req = new Request('http://localhost/api/dashboard/clients', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '김철수' }), // phone 없음
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('전화번호')
  })

  it('11자리 전화번호를 정규화해서 저장한다', async () => {
    const firm = mockFirm()
    const client = mockClient()
    mockAuth()

    const firmChain = createQueryChain(firm, null)
    const insertChain = createQueryChain(client, null)

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(firmChain as never)
      .mockReturnValueOnce(insertChain as never)

    const { POST } = await import('~app/api/dashboard/clients/route')
    const req = new Request('http://localhost/api/dashboard/clients', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '김철수', phone: '01012345678' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.client).toBeDefined()
    expect(body.client.case_count).toBe(0)
  })

  it('중복 전화번호이면 409를 반환한다', async () => {
    const firm = mockFirm()
    mockAuth()

    const firmChain = createQueryChain(firm, null)
    const insertChain = createQueryChain(null, { code: '23505', message: 'unique violation' })

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(firmChain as never)
      .mockReturnValueOnce(insertChain as never)

    const { POST } = await import('~app/api/dashboard/clients/route')
    const req = new Request('http://localhost/api/dashboard/clients', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '김철수', phone: '010-1234-5678' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain('이미 등록')
  })
})

// ── GET /api/dashboard/clients ────────────────────────────────────────────────
describe('GET /api/dashboard/clients', () => {
  beforeEach(() => vi.resetAllMocks())

  it('토큰이 없으면 401을 반환한다', async () => {
    mockAuthFail()
    const { GET } = await import('~app/api/dashboard/clients/route')
    const res = await GET(new Request('http://localhost/api/dashboard/clients'))
    expect(res.status).toBe(401)
  })

  it('고객이 없으면 빈 배열을 반환한다', async () => {
    const firm = mockFirm()
    mockAuth()

    const firmChain    = createQueryChain(firm, null)
    const countChain   = createQueryChain(null, null)  // Promise.all count query
    const clientsChain = createQueryChain([], null)

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(firmChain as never)
      .mockReturnValueOnce(countChain as never)
      .mockReturnValueOnce(clientsChain as never)

    const { GET } = await import('~app/api/dashboard/clients/route')
    const req = new Request('http://localhost/api/dashboard/clients', {
      headers: { Authorization: 'Bearer valid-token' },
    })

    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.clients).toEqual([])
  })

  it('고객 목록에 case_count를 포함해 반환한다', async () => {
    const firm = mockFirm()
    const clients = [mockClient({ id: 'client-001' }), mockClient({ id: 'client-002' })]
    const summaryRows = [
      { client_id: 'client-001' },
      { client_id: 'client-001' },
      { client_id: 'client-002' },
    ]
    mockAuth()

    const firmChain      = createQueryChain(firm, null)
    const countChain     = createQueryChain(null, null)  // Promise.all count query
    const clientsChain   = createQueryChain(clients, null)
    const caseCountChain = createQueryChain(summaryRows, null)

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(firmChain as never)
      .mockReturnValueOnce(countChain as never)
      .mockReturnValueOnce(clientsChain as never)
      .mockReturnValueOnce(caseCountChain as never)

    const { GET } = await import('~app/api/dashboard/clients/route')
    const req = new Request('http://localhost/api/dashboard/clients', {
      headers: { Authorization: 'Bearer valid-token' },
    })

    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.clients).toHaveLength(2)
    expect(body.clients[0].case_count).toBe(2)
    expect(body.clients[1].case_count).toBe(1)
  })
})

// ── GET /api/dashboard/clients/[id] ──────────────────────────────────────────
describe('GET /api/dashboard/clients/[id]', () => {
  beforeEach(() => vi.resetAllMocks())

  it('토큰이 없으면 401을 반환한다', async () => {
    mockAuthFail()
    const { GET } = await import('~app/api/dashboard/clients/[id]/route')
    const req = new Request('http://localhost/api/dashboard/clients/client-001')
    const params = Promise.resolve({ id: 'client-001' })
    const res = await GET(req, { params })
    expect(res.status).toBe(401)
  })

  it('존재하지 않는 고객은 404를 반환한다', async () => {
    const firm = mockFirm()
    mockAuth()

    const firmChain = createQueryChain(firm, null)
    const clientChain = createQueryChain(null, null)

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(firmChain as never)
      .mockReturnValueOnce(clientChain as never)

    const { GET } = await import('~app/api/dashboard/clients/[id]/route')
    const req = new Request('http://localhost/api/dashboard/clients/nonexistent', {
      headers: { Authorization: 'Bearer valid-token' },
    })
    const params = Promise.resolve({ id: 'nonexistent' })

    const res = await GET(req, { params })
    expect(res.status).toBe(404)
  })

  it('고객 상세 + 사건 + 상담 기록을 반환한다', async () => {
    const firm = mockFirm()
    const client = mockClient()
    const cases = [{ id: 'cs-001', case_type: '교통사고', status: 'new', created_at: new Date().toISOString() }]
    const recordings = [{ id: 'rec-001', title: '교통사고 상담', status: 'completed', duration_seconds: 1800, created_at: new Date().toISOString() }]
    mockAuth()

    const firmChain = createQueryChain(firm, null)
    const clientChain = createQueryChain(client, null)
    const casesChain = createQueryChain(cases, null)
    const recordingsChain = createQueryChain(recordings, null)

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(firmChain as never)
      .mockReturnValueOnce(clientChain as never)
      .mockReturnValueOnce(casesChain as never)
      .mockReturnValueOnce(recordingsChain as never)

    const { GET } = await import('~app/api/dashboard/clients/[id]/route')
    const req = new Request('http://localhost/api/dashboard/clients/client-001', {
      headers: { Authorization: 'Bearer valid-token' },
    })
    const params = Promise.resolve({ id: 'client-001' })

    const res = await GET(req, { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.client).toBeDefined()
    expect(body.cases).toHaveLength(1)
    expect(body.recordings).toHaveLength(1)
    expect(body.recordings[0].status).toBe('completed')
  })
})

// ── PATCH /api/dashboard/clients/[id] ────────────────────────────────────────
describe('PATCH /api/dashboard/clients/[id]', () => {
  beforeEach(() => vi.resetAllMocks())

  it('토큰이 없으면 401을 반환한다', async () => {
    mockAuthFail()
    const { PATCH } = await import('~app/api/dashboard/clients/[id]/route')
    const req = new Request('http://localhost/api/dashboard/clients/client-001', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '이름 변경' }),
    })
    const params = Promise.resolve({ id: 'client-001' })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(401)
  })

  it('수정할 필드가 없으면 400을 반환한다', async () => {
    const firm = mockFirm()
    mockAuth()

    const firmChain = createQueryChain(firm, null)
    vi.mocked(supabaseAdmin.from).mockReturnValue(firmChain as never)

    const { PATCH } = await import('~app/api/dashboard/clients/[id]/route')
    const req = new Request('http://localhost/api/dashboard/clients/client-001', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ unknown_field: 'value' }),
    })
    const params = Promise.resolve({ id: 'client-001' })

    const res = await PATCH(req, { params })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('수정할 항목')
  })

  it('이름 수정 시 200과 updated client를 반환한다', async () => {
    const firm = mockFirm()
    const updatedClient = mockClient({ name: '이름 변경' })
    mockAuth()

    const firmChain = createQueryChain(firm, null)
    const updateChain = createQueryChain(updatedClient, null)

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(firmChain as never)
      .mockReturnValueOnce(updateChain as never)

    const { PATCH } = await import('~app/api/dashboard/clients/[id]/route')
    const req = new Request('http://localhost/api/dashboard/clients/client-001', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '이름 변경' }),
    })
    const params = Promise.resolve({ id: 'client-001' })

    const res = await PATCH(req, { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.client.name).toBe('이름 변경')
  })
})

// ── DELETE /api/dashboard/clients/[id] ───────────────────────────────────────
describe('DELETE /api/dashboard/clients/[id]', () => {
  beforeEach(() => vi.resetAllMocks())

  it('토큰이 없으면 401을 반환한다', async () => {
    mockAuthFail()
    const { DELETE } = await import('~app/api/dashboard/clients/[id]/route')
    const req = new Request('http://localhost/api/dashboard/clients/client-001', { method: 'DELETE' })
    const params = Promise.resolve({ id: 'client-001' })
    const res = await DELETE(req, { params })
    expect(res.status).toBe(401)
  })

  it('고객 삭제 시 cases 언링크 후 삭제한다', async () => {
    const firm = mockFirm()
    mockAuth()

    const firmChain        = createQueryChain(firm, null)
    const casesUnlinkChain = createQueryChain(null, null)  // cases update
    const deleteChain      = createQueryChain(null, null)  // clients delete

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(firmChain as never)           // getAuthFirmId firms
      .mockReturnValueOnce(casesUnlinkChain as never)    // cases update
      .mockReturnValueOnce(deleteChain as never)         // clients delete

    const { DELETE } = await import('~app/api/dashboard/clients/[id]/route')
    const req = new Request('http://localhost/api/dashboard/clients/client-001', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer valid-token' },
    })
    const params = Promise.resolve({ id: 'client-001' })

    const res = await DELETE(req, { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)

    // 3번 from() 호출 확인 (sessions 제거됨)
    expect(vi.mocked(supabaseAdmin.from)).toHaveBeenCalledTimes(3)
  })
})
