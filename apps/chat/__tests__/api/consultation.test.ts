/**
 * PATCH /api/cases/:id/consultation validation tests
 * Tests pure request validation and date logic
 */
import { describe, it, expect } from 'vitest'

// --- Pure validation helpers ---

// ISO 8601만 허용: YYYY-MM-DD 또는 YYYY-MM-DDTHH:MM:SS... 형식
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?([.\d]*)?(Z|[+-]\d{2}:?\d{2})?)?$/

function isValidIsoDate(value: unknown): boolean {
  if (value === null || value === undefined) return true  // null = 삭제 허용
  if (typeof value !== 'string' || value.length === 0) return false
  if (!ISO_DATE_REGEX.test(value)) return false
  const d = new Date(value)
  return !isNaN(d.getTime())
}

function validateConsultationRequest(params: {
  isAuthenticated: boolean
  firmId: string | null
  caseFirmId: string
  consultation_at: unknown
}): { status: number; error?: string } | { status: 200 } {
  if (!params.isAuthenticated || !params.firmId) {
    return { status: 401, error: 'Unauthorized' }
  }
  if (params.firmId !== params.caseFirmId) {
    return { status: 403, error: '접근 권한이 없습니다' }
  }
  if (!isValidIsoDate(params.consultation_at)) {
    return { status: 400, error: '유효하지 않은 날짜 형식입니다' }
  }
  return { status: 200 }
}

// ---

describe('날짜 형식 검증', () => {
  it('ISO 8601 날짜 문자열 → 유효', () => {
    expect(isValidIsoDate('2026-03-15T10:00:00+09:00')).toBe(true)
  })

  it('날짜만 있는 문자열 → 유효', () => {
    expect(isValidIsoDate('2026-03-15')).toBe(true)
  })

  it('null → 유효 (삭제 허용)', () => {
    expect(isValidIsoDate(null)).toBe(true)
  })

  it('undefined → 유효 (삭제 허용)', () => {
    expect(isValidIsoDate(undefined)).toBe(true)
  })

  it('과거 날짜도 유효 (이미 지난 상담)', () => {
    expect(isValidIsoDate('2020-01-01T09:00:00Z')).toBe(true)
  })

  it('숫자 → 무효', () => {
    expect(isValidIsoDate(12345)).toBe(false)
  })

  it('형식이 잘못된 문자열 → 무효', () => {
    expect(isValidIsoDate('not-a-date')).toBe(false)
    expect(isValidIsoDate('2026/03/15')).toBe(false)
    expect(isValidIsoDate('15-03-2026')).toBe(false)
  })

  it('빈 문자열 → 무효', () => {
    expect(isValidIsoDate('')).toBe(false)
  })
})

describe('PATCH /api/cases/:id/consultation', () => {
  const validParams = {
    isAuthenticated: true,
    firmId: 'firm-A',
    caseFirmId: 'firm-A',
    consultation_at: '2026-03-15T10:00:00+09:00',
  }

  it('정상 날짜 설정 → 200', () => {
    expect(validateConsultationRequest(validParams).status).toBe(200)
  })

  it('날짜 수정 → 200', () => {
    const r = validateConsultationRequest({ ...validParams, consultation_at: '2026-04-01T14:00:00+09:00' })
    expect(r.status).toBe(200)
  })

  it('null로 설정(삭제) → 200', () => {
    const r = validateConsultationRequest({ ...validParams, consultation_at: null })
    expect(r.status).toBe(200)
  })

  it('과거 날짜도 설정 가능 → 200', () => {
    const r = validateConsultationRequest({ ...validParams, consultation_at: '2023-01-15T09:00:00Z' })
    expect(r.status).toBe(200)
  })

  it('비로그인 → 401', () => {
    const r = validateConsultationRequest({ ...validParams, isAuthenticated: false, firmId: null })
    expect(r.status).toBe(401)
  })

  it('다른 사무소 사건 → 403', () => {
    const r = validateConsultationRequest({ ...validParams, caseFirmId: 'firm-B' })
    expect(r.status).toBe(403)
  })

  it('유효하지 않은 날짜 형식 → 400', () => {
    const r = validateConsultationRequest({ ...validParams, consultation_at: 'not-a-date' })
    expect(r.status).toBe(400)
  })

  it('숫자로 전달 → 400', () => {
    const r = validateConsultationRequest({ ...validParams, consultation_at: 1234567890 })
    expect(r.status).toBe(400)
  })
})
