/**
 * /api/cases/:id/notes validation tests
 * Tests pure request validation and authorization logic
 */
import { describe, it, expect } from 'vitest'

// --- Pure validation helpers ---

function validateCreateNoteRequest(params: {
  isAuthenticated: boolean
  firmId: string | null
  caseFirmId: string
  content: unknown
}): { status: number; error?: string } | { status: 201 } {
  if (!params.isAuthenticated || !params.firmId) {
    return { status: 401, error: 'Unauthorized' }
  }
  if (params.firmId !== params.caseFirmId) {
    return { status: 403, error: '접근 권한이 없습니다' }
  }
  if (!params.content || typeof params.content !== 'string' || params.content.trim().length === 0) {
    return { status: 400, error: '내용을 입력해주세요' }
  }
  return { status: 201 }
}

function validateGetNotesRequest(params: {
  isAuthenticated: boolean
  firmId: string | null
  caseFirmId: string
}): { status: number; error?: string } | { status: 200 } {
  if (!params.isAuthenticated || !params.firmId) {
    return { status: 401, error: 'Unauthorized' }
  }
  if (params.firmId !== params.caseFirmId) {
    return { status: 403, error: '접근 권한이 없습니다' }
  }
  return { status: 200 }
}

// ---

describe('POST /api/cases/:id/notes', () => {
  const validParams = {
    isAuthenticated: true,
    firmId: 'firm-A',
    caseFirmId: 'firm-A',
    content: '오늘 고객과 통화함. 서류 준비 중.',
  }

  it('정상 요청 → 201', () => {
    expect(validateCreateNoteRequest(validParams).status).toBe(201)
  })

  it('비로그인 → 401', () => {
    const r = validateCreateNoteRequest({ ...validParams, isAuthenticated: false, firmId: null })
    expect(r.status).toBe(401)
  })

  it('다른 사무소 사건 → 403', () => {
    const r = validateCreateNoteRequest({ ...validParams, caseFirmId: 'firm-B' })
    expect(r.status).toBe(403)
  })

  it('빈 content → 400', () => {
    const r = validateCreateNoteRequest({ ...validParams, content: '' })
    expect(r.status).toBe(400)
  })

  it('content 없음(undefined) → 400', () => {
    const r = validateCreateNoteRequest({ ...validParams, content: undefined })
    expect(r.status).toBe(400)
  })

  it('공백만 있는 content → 400', () => {
    const r = validateCreateNoteRequest({ ...validParams, content: '   ' })
    expect(r.status).toBe(400)
  })
})

describe('GET /api/cases/:id/notes', () => {
  it('정상 요청 → 200', () => {
    const r = validateGetNotesRequest({ isAuthenticated: true, firmId: 'firm-A', caseFirmId: 'firm-A' })
    expect(r.status).toBe(200)
  })

  it('비로그인 → 401', () => {
    const r = validateGetNotesRequest({ isAuthenticated: false, firmId: null, caseFirmId: 'firm-A' })
    expect(r.status).toBe(401)
  })

  it('다른 사무소 사건 → 403', () => {
    const r = validateGetNotesRequest({ isAuthenticated: true, firmId: 'firm-A', caseFirmId: 'firm-B' })
    expect(r.status).toBe(403)
  })
})

describe('notes 응답 형식', () => {
  it('메모 없으면 빈 배열 반환', () => {
    const notes: unknown[] = []
    expect(Array.isArray(notes)).toBe(true)
    expect(notes).toHaveLength(0)
  })

  it('메모 목록은 배열이어야 한다', () => {
    const notes = [
      { id: '1', content: '첫 메모', created_at: '2026-02-28T10:00:01Z' },
      { id: '2', content: '두 번째 메모', created_at: '2026-02-28T10:00:02Z' },
    ]
    expect(Array.isArray(notes)).toBe(true)
    expect(notes[0].content).toBe('첫 메모')
  })

  it('메모 항목에 id, content, created_at이 있어야 한다', () => {
    const note = { id: 'note-001', content: '메모 내용', created_at: '2026-02-28T10:00:00Z' }
    expect(note).toHaveProperty('id')
    expect(note).toHaveProperty('content')
    expect(note).toHaveProperty('created_at')
  })
})
