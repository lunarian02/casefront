/**
 * tests/unit/api/case-recordings.test.ts
 *
 * GET /api/dashboard/cases/[id]/recordings — 사건에 연결된 녹음 목록
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createQueryChain, mockFirm, mockRecording } from '../helpers/supabase-mock'

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

describe('GET /api/dashboard/cases/[id]/recordings', () => {
  beforeEach(() => vi.resetAllMocks())

  it('토큰이 없으면 401을 반환한다', async () => {
    mockAuthFail()
    const { GET } = await import('~app/api/dashboard/cases/[id]/recordings/route')
    const req = new Request('http://localhost/api/dashboard/cases/sess-001/recordings')
    const params = Promise.resolve({ id: 'sess-001' })
    const res = await GET(req, { params })
    expect(res.status).toBe(401)
  })

  it('링크된 녹음이 없으면 빈 배열을 반환한다', async () => {
    const firm = mockFirm()
    mockAuth()

    const firmChain = createQueryChain(firm, null)
    // cases lookup (caseRow = null → returns [] early)
    const caseChain = createQueryChain(null, null)

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(firmChain as never)
      .mockReturnValueOnce(caseChain as never)

    const { GET } = await import('~app/api/dashboard/cases/[id]/recordings/route')
    const req = new Request('http://localhost/api/dashboard/cases/sess-001/recordings', {
      headers: { Authorization: 'Bearer valid-token' },
    })
    const params = Promise.resolve({ id: 'sess-001' })

    const res = await GET(req, { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.recordings).toEqual([])
  })

  it('링크된 녹음 목록을 반환한다', async () => {
    const firm = mockFirm()
    const links = [{ recording_id: 'rec-001' }, { recording_id: 'rec-002' }]
    const recordings = [
      mockRecording({ id: 'rec-001' }),
      mockRecording({ id: 'rec-002', title: '형사 상담' }),
    ]
    mockAuth()

    const firmChain = createQueryChain(firm, null)
    const caseChain = createQueryChain({ id: 1 }, null) // cases lookup
    const linksChain = createQueryChain(links, null)
    const recordingsChain = createQueryChain(recordings, null)

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(firmChain as never)
      .mockReturnValueOnce(caseChain as never)       // cases → caseId
      .mockReturnValueOnce(linksChain as never)
      .mockReturnValueOnce(recordingsChain as never)

    const { GET } = await import('~app/api/dashboard/cases/[id]/recordings/route')
    const req = new Request('http://localhost/api/dashboard/cases/sess-001/recordings', {
      headers: { Authorization: 'Bearer valid-token' },
    })
    const params = Promise.resolve({ id: 'sess-001' })

    const res = await GET(req, { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.recordings).toHaveLength(2)
    expect(body.recordings[0].id).toBe('rec-001')
  })
})
