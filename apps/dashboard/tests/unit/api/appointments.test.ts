/**
 * tests/unit/api/appointments.test.ts
 *
 * PATCH  /api/dashboard/appointments/[aptId] — 일정 수정
 * DELETE /api/dashboard/appointments/[aptId] — 일정 삭제
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createQueryChain } from '../helpers/supabase-mock'

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

function mockAppointment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'apt-001',
    user_id: 'user-123',
    title: '첫 상담',
    appointment_type: 'consultation',
    scheduled_at: new Date().toISOString(),
    memo: null,
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

// ── PATCH ─────────────────────────────────────────────────────────────────────
describe('PATCH /api/dashboard/appointments/[aptId]', () => {
  beforeEach(() => vi.resetAllMocks())

  it('토큰이 없으면 401을 반환한다', async () => {
    mockAuthFail()
    const { PATCH } = await import('~app/api/dashboard/appointments/[aptId]/route')
    const req = new Request('http://localhost/api/dashboard/appointments/apt-001', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '변경된 제목' }),
    })
    const params = Promise.resolve({ aptId: 'apt-001' })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(401)
  })

  it('일정 수정 시 200과 updated appointment를 반환한다', async () => {
    const apt = mockAppointment({ title: '변경된 제목' })
    mockAuth()

    const updateChain = createQueryChain(apt, null)
    vi.mocked(supabaseAdmin.from).mockReturnValue(updateChain as never)

    const { PATCH } = await import('~app/api/dashboard/appointments/[aptId]/route')
    const req = new Request('http://localhost/api/dashboard/appointments/apt-001', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '변경된 제목', memo: '메모 추가' }),
    })
    const params = Promise.resolve({ aptId: 'apt-001' })

    const res = await PATCH(req, { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.appointment.title).toBe('변경된 제목')
  })

  it('memo가 빈 문자열이면 null로 저장한다', async () => {
    const apt = mockAppointment({ memo: null })
    mockAuth()

    const updateChain = createQueryChain(apt, null)
    vi.mocked(supabaseAdmin.from).mockReturnValue(updateChain as never)

    const { PATCH } = await import('~app/api/dashboard/appointments/[aptId]/route')
    const req = new Request('http://localhost/api/dashboard/appointments/apt-001', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ memo: '' }),
    })
    const params = Promise.resolve({ aptId: 'apt-001' })

    const res = await PATCH(req, { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.appointment.memo).toBeNull()
  })
})

// ── DELETE ────────────────────────────────────────────────────────────────────
describe('DELETE /api/dashboard/appointments/[aptId]', () => {
  beforeEach(() => vi.resetAllMocks())

  it('토큰이 없으면 401을 반환한다', async () => {
    mockAuthFail()
    const { DELETE } = await import('~app/api/dashboard/appointments/[aptId]/route')
    const req = new Request('http://localhost/api/dashboard/appointments/apt-001', { method: 'DELETE' })
    const params = Promise.resolve({ aptId: 'apt-001' })
    const res = await DELETE(req, { params })
    expect(res.status).toBe(401)
  })

  it('일정 삭제 시 204를 반환한다', async () => {
    mockAuth()

    const deleteChain = createQueryChain(null, null)
    vi.mocked(supabaseAdmin.from).mockReturnValue(deleteChain as never)

    const { DELETE } = await import('~app/api/dashboard/appointments/[aptId]/route')
    const req = new Request('http://localhost/api/dashboard/appointments/apt-001', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer valid-token' },
    })
    const params = Promise.resolve({ aptId: 'apt-001' })

    const res = await DELETE(req, { params })
    expect(res.status).toBe(204)
  })
})
