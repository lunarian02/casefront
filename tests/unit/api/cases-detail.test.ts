/**
 * tests/unit/api/cases-detail.test.ts
 *
 * GET    /api/dashboard/cases/[id] — 사건 상세
 * PATCH  /api/dashboard/cases/[id] — 상태변경 / 부모연결 / 필드수정
 * DELETE /api/dashboard/cases/[id] — 사건 삭제
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

function mockCase(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    session_id: 'sess-001',
    client_id: 'client-001',
    client_name: '김철수',
    client_phone: '010-1234-5678',
    case_type: '교통사고',
    status: 'new',
    summary: {},
    parent_case_id: null,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

// ── GET ───────────────────────────────────────────────────────────────────────
describe('GET /api/dashboard/cases/[id]', () => {
  beforeEach(() => vi.resetAllMocks())

  it('토큰이 없으면 401을 반환한다', async () => {
    mockAuthFail()
    const { GET } = await import('~app/api/dashboard/cases/[id]/route')
    const req = new Request('http://localhost/api/dashboard/cases/sess-001')
    const params = Promise.resolve({ id: 'sess-001' })
    const res = await GET(req, { params })
    expect(res.status).toBe(401)
  })

  it('존재하지 않는 사건은 404를 반환한다', async () => {
    const firm = mockFirm()
    mockAuth()

    const firmChain = createQueryChain(firm, null)
    const caseChain = createQueryChain(null, null)

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(firmChain as never)
      .mockReturnValueOnce(caseChain as never)

    const { GET } = await import('~app/api/dashboard/cases/[id]/route')
    const req = new Request('http://localhost/api/dashboard/cases/nonexistent', {
      headers: { Authorization: 'Bearer valid-token' },
    })
    const params = Promise.resolve({ id: 'nonexistent' })

    const res = await GET(req, { params })
    expect(res.status).toBe(404)
  })

  it('사건 + liveClient + clientCases를 반환한다', async () => {
    const firm = mockFirm()
    const caseData = mockCase()
    const liveClient = { id: 'client-001', name: '김철수', phone: '010-1234-5678', email: null, referrer: null }
    mockAuth()

    const firmChain = createQueryChain(firm, null)
    const caseChain = createQueryChain(caseData, null)
    const clientChain = createQueryChain(liveClient, null)
    const clientCasesChain = createQueryChain([], null)

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(firmChain as never)
      .mockReturnValueOnce(caseChain as never)
      .mockReturnValueOnce(clientChain as never)
      .mockReturnValueOnce(clientCasesChain as never)

    const { GET } = await import('~app/api/dashboard/cases/[id]/route')
    const req = new Request('http://localhost/api/dashboard/cases/sess-001', {
      headers: { Authorization: 'Bearer valid-token' },
    })
    const params = Promise.resolve({ id: 'sess-001' })

    const res = await GET(req, { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.case.channel).toBe('web')
    expect(body.client?.name).toBe('김철수')
    expect(Array.isArray(body.clientCases)).toBe(true)
  })
})

// ── PATCH ─────────────────────────────────────────────────────────────────────
describe('PATCH /api/dashboard/cases/[id]', () => {
  beforeEach(() => vi.resetAllMocks())

  it('토큰이 없으면 401을 반환한다', async () => {
    mockAuthFail()
    const { PATCH } = await import('~app/api/dashboard/cases/[id]/route')
    const req = new Request('http://localhost/api/dashboard/cases/sess-001', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'reviewing' }),
    })
    const params = Promise.resolve({ id: 'sess-001' })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(401)
  })

  it('유효하지 않은 status 값은 400을 반환한다', async () => {
    const firm = mockFirm()
    mockAuth()

    const firmChain = createQueryChain(firm, null)
    vi.mocked(supabaseAdmin.from).mockReturnValue(firmChain as never)

    const { PATCH } = await import('~app/api/dashboard/cases/[id]/route')
    const req = new Request('http://localhost/api/dashboard/cases/sess-001', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'invalid_status' }),
    })
    const params = Promise.resolve({ id: 'sess-001' })

    const res = await PATCH(req, { params })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('유효하지 않은 상태값')
  })

  it('status 업데이트 시 200을 반환한다', async () => {
    const firm = mockFirm()
    const updatedCase = mockCase({ status: 'reviewing' })
    mockAuth()

    const firmChain = createQueryChain(firm, null)
    const updateChain = createQueryChain(updatedCase, null)

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(firmChain as never)
      .mockReturnValueOnce(updateChain as never)

    const { PATCH } = await import('~app/api/dashboard/cases/[id]/route')
    const req = new Request('http://localhost/api/dashboard/cases/sess-001', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'reviewing' }),
    })
    const params = Promise.resolve({ id: 'sess-001' })

    const res = await PATCH(req, { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.case.status).toBe('reviewing')
  })

  it('parent_case_id 연결 시 200을 반환한다', async () => {
    const firm = mockFirm()
    const updatedCase = mockCase({ parent_case_id: 'parent-001' })
    mockAuth()

    const firmChain = createQueryChain(firm, null)
    const updateChain = createQueryChain(updatedCase, null)

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(firmChain as never)
      .mockReturnValueOnce(updateChain as never)

    const { PATCH } = await import('~app/api/dashboard/cases/[id]/route')
    const req = new Request('http://localhost/api/dashboard/cases/sess-001', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ parent_case_id: 'parent-001' }),
    })
    const params = Promise.resolve({ id: 'sess-001' })

    const res = await PATCH(req, { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.case.parent_case_id).toBe('parent-001')
  })

  it('수정할 항목이 없으면 400을 반환한다', async () => {
    const firm = mockFirm()
    mockAuth()

    const firmChain = createQueryChain(firm, null)
    vi.mocked(supabaseAdmin.from).mockReturnValue(firmChain as never)

    const { PATCH } = await import('~app/api/dashboard/cases/[id]/route')
    const req = new Request('http://localhost/api/dashboard/cases/sess-001', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ unknown_field: 'value' }),
    })
    const params = Promise.resolve({ id: 'sess-001' })

    const res = await PATCH(req, { params })
    expect(res.status).toBe(400)
  })
})

// ── DELETE ────────────────────────────────────────────────────────────────────
describe('DELETE /api/dashboard/cases/[id]', () => {
  beforeEach(() => vi.resetAllMocks())

  it('토큰이 없으면 401을 반환한다', async () => {
    mockAuthFail()
    const { DELETE } = await import('~app/api/dashboard/cases/[id]/route')
    const req = new Request('http://localhost/api/dashboard/cases/sess-001', { method: 'DELETE' })
    const params = Promise.resolve({ id: 'sess-001' })
    const res = await DELETE(req, { params })
    expect(res.status).toBe(401)
  })

  it('존재하지 않는 사건은 404를 반환한다', async () => {
    const firm = mockFirm()
    mockAuth()

    const firmChain = createQueryChain(firm, null)
    const findChain = createQueryChain(null, null)

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(firmChain as never)
      .mockReturnValueOnce(findChain as never)

    const { DELETE } = await import('~app/api/dashboard/cases/[id]/route')
    const req = new Request('http://localhost/api/dashboard/cases/nonexistent', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer valid-token' },
    })
    const params = Promise.resolve({ id: 'nonexistent' })

    const res = await DELETE(req, { params })
    expect(res.status).toBe(404)
  })

  it('사건 삭제 시 case_notes/files 먼저 삭제 후 case_summary를 삭제한다', async () => {
    const firm = mockFirm()
    const caseData = { id: 42 }
    mockAuth()

    const firmChain = createQueryChain(firm, null)
    const findChain = createQueryChain(caseData, null)
    const notesChain = createQueryChain(null, null)
    const filesChain = createQueryChain(null, null)
    const deleteChain = createQueryChain(null, null)

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(firmChain as never)   // getAuthFirm
      .mockReturnValueOnce(findChain as never)   // case_summaries find
      .mockReturnValueOnce(notesChain as never)  // case_notes delete
      .mockReturnValueOnce(filesChain as never)  // files delete
      .mockReturnValueOnce(deleteChain as never) // case_summaries delete

    const { DELETE } = await import('~app/api/dashboard/cases/[id]/route')
    const req = new Request('http://localhost/api/dashboard/cases/sess-001', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer valid-token' },
    })
    const params = Promise.resolve({ id: 'sess-001' })

    const res = await DELETE(req, { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(vi.mocked(supabaseAdmin.from)).toHaveBeenCalledTimes(5)
  })
})
