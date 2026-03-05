/**
 * tests/unit/api/recordings.test.ts
 *
 * GET /api/dashboard/recordings      — 목록 조회
 * GET /api/dashboard/recordings/[id] — 단건 조회
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createQueryChain, mockFirm, mockRecording } from '../helpers/supabase-mock'

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
    storage: {
      from: vi.fn().mockReturnValue({
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://storage.example.com/signed' },
          error: null,
        }),
      }),
    },
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

// ── 목록 ─────────────────────────────────────────────────────────────────────
describe('GET /api/dashboard/recordings', () => {
  beforeEach(() => vi.resetAllMocks())

  it('토큰이 없으면 401을 반환한다', async () => {
    mockAuthFail()
    const { GET } = await import('~app/api/dashboard/recordings/route')
    const req = new Request('http://localhost/api/dashboard/recordings')

    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('인증된 firm의 recordings 목록을 반환한다', async () => {
    const firm = mockFirm({ id: 'firm-abc' })
    const recordings = [
      mockRecording({ reports: null }),
      mockRecording({ id: 'rec-002', title: '형사 상담', reports: null }),
    ]
    mockAuth()

    const firmChain  = createQueryChain(firm, null)
    const countChain = createQueryChain(null, null)  // Promise.all count query
    const recChain   = createQueryChain(recordings, null)

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(firmChain as never)   // firms
      .mockReturnValueOnce(countChain as never)  // recordings count
      .mockReturnValueOnce(recChain as never)    // recordings data

    const { GET } = await import('~app/api/dashboard/recordings/route')
    const req = new Request('http://localhost/api/dashboard/recordings', {
      headers: { Authorization: 'Bearer valid-token' },
    })

    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.recordings)).toBe(true)
    expect(body.recordings).toHaveLength(2)
  })

  it('recordings가 없으면 빈 배열을 반환한다', async () => {
    const firm = mockFirm()
    mockAuth()

    const firmChain  = createQueryChain(firm, null)
    const countChain = createQueryChain(null, null)  // Promise.all count query
    const recChain   = createQueryChain([], null)

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(firmChain as never)
      .mockReturnValueOnce(countChain as never)
      .mockReturnValueOnce(recChain as never)

    const { GET } = await import('~app/api/dashboard/recordings/route')
    const req = new Request('http://localhost/api/dashboard/recordings', {
      headers: { Authorization: 'Bearer valid-token' },
    })

    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.recordings).toEqual([])
  })
})

// ── 단건 ─────────────────────────────────────────────────────────────────────
describe('GET /api/dashboard/recordings/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // storage mock 리셋
    vi.mocked(supabaseAdmin.storage.from).mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://storage.example.com/signed' },
        error: null,
      }),
    } as never)
  })

  it('토큰이 없으면 401을 반환한다', async () => {
    mockAuthFail()
    const { GET } = await import('~app/api/dashboard/recordings/[id]/route')
    const req = new Request('http://localhost/api/dashboard/recordings/rec-001')
    const params = Promise.resolve({ id: 'rec-001' })

    const res = await GET(req, { params })

    expect(res.status).toBe(401)
  })

  it('존재하지 않는 recording 접근 시 404를 반환한다', async () => {
    const firm = mockFirm()
    mockAuth()

    // getAuthFirm: firms
    const firmChain = createQueryChain(firm, null)
    // recordings — not found (data=null)
    const recChain  = createQueryChain(null, null)

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(firmChain as never)
      .mockReturnValueOnce(recChain as never)

    const { GET } = await import('~app/api/dashboard/recordings/[id]/route')
    const req = new Request('http://localhost/api/dashboard/recordings/nonexistent', {
      headers: { Authorization: 'Bearer valid-token' },
    })
    const params = Promise.resolve({ id: 'nonexistent' })

    const res = await GET(req, { params })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Not found')
  })

  it('존재하는 recording은 report/transcript/signedUrl을 포함해 반환한다', async () => {
    const firm      = mockFirm()
    const recording = mockRecording()
    const report    = { id: 'rep-001', case_type: '교통사고', content: '...', created_at: new Date().toISOString() }
    const transcript = { id: 'trx-001', full_text: '안녕하세요...', segments: [] }
    mockAuth()

    const firmChain       = createQueryChain(firm, null)
    const recChain        = createQueryChain(recording, null)
    const reportChain     = createQueryChain(report, null)
    const transcriptChain = createQueryChain(transcript, null)
    const linksChain      = createQueryChain([], null)

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(firmChain as never)       // firms (getAuthFirm)
      .mockReturnValueOnce(recChain as never)        // recordings
      .mockReturnValueOnce(reportChain as never)     // reports
      .mockReturnValueOnce(transcriptChain as never) // transcripts
      .mockReturnValueOnce(linksChain as never)      // recording_case_links

    const { GET } = await import('~app/api/dashboard/recordings/[id]/route')
    const req = new Request('http://localhost/api/dashboard/recordings/rec-001', {
      headers: { Authorization: 'Bearer valid-token' },
    })
    const params = Promise.resolve({ id: 'rec-001' })

    const res = await GET(req, { params })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.recording).toBeDefined()
    expect(body.report).toBeDefined()
    expect(body.transcript).toBeDefined()
    expect(body.signedUrl).toContain('https://')
    expect(Array.isArray(body.linkedCases)).toBe(true)
  })
})
