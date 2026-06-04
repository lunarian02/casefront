/**
 * caseNotesService unit tests
 * Tests pure validation logic for lawyer case notes
 */
import { describe, it, expect } from 'vitest'

// --- Pure validation helpers ---

function validateNoteContent(content: unknown): { valid: boolean; error?: string } {
  if (content === null || content === undefined) {
    return { valid: false, error: '내용을 입력해주세요' }
  }
  if (typeof content !== 'string') {
    return { valid: false, error: '내용은 문자열이어야 합니다' }
  }
  if (content.trim().length === 0) {
    return { valid: false, error: '내용을 입력해주세요' }
  }
  if (content.length > 5000) {
    return { valid: false, error: '메모는 5,000자를 초과할 수 없습니다' }
  }
  return { valid: true }
}

function sortNotesByTime(notes: Array<{ content: string; created_at: string }>) {
  return [...notes].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
}

function canAccessNote(noteFirmId: string, requestFirmId: string): boolean {
  return noteFirmId === requestFirmId
}

// ---

describe('case_notes 내용 검증', () => {
  it('정상 메모 → 통과', () => {
    expect(validateNoteContent('오늘 고객과 통화함. 서류 준비 중.').valid).toBe(true)
  })

  it('빈 문자열 → 실패', () => {
    const { valid, error } = validateNoteContent('')
    expect(valid).toBe(false)
    expect(error).toBeDefined()
  })

  it('공백만 있는 문자열 → 실패', () => {
    expect(validateNoteContent('   ').valid).toBe(false)
  })

  it('null → 실패', () => {
    expect(validateNoteContent(null).valid).toBe(false)
  })

  it('undefined → 실패', () => {
    expect(validateNoteContent(undefined).valid).toBe(false)
  })

  it('숫자 → 실패 (문자열이어야 함)', () => {
    expect(validateNoteContent(123).valid).toBe(false)
  })

  it('정확히 5000자 → 통과 (경계값)', () => {
    const content = 'a'.repeat(5000)
    expect(validateNoteContent(content).valid).toBe(true)
  })

  it('5001자 → 실패', () => {
    const { valid, error } = validateNoteContent('a'.repeat(5001))
    expect(valid).toBe(false)
    expect(error).toContain('5,000자')
  })

  it('한글 메모 → 통과', () => {
    expect(validateNoteContent('고객이 차용증 사본 제출함. 변제기는 2024년 3월.').valid).toBe(true)
  })

  it('특수문자/이모지 포함 → 통과', () => {
    expect(validateNoteContent('중요! 📌 증거자료 확보 완료 (계좌이체 내역)').valid).toBe(true)
  })
})

describe('case_notes 정렬', () => {
  const notes = [
    { content: '세 번째 메모', created_at: '2026-02-28T12:00:03Z' },
    { content: '첫 번째 메모', created_at: '2026-02-28T12:00:01Z' },
    { content: '두 번째 메모', created_at: '2026-02-28T12:00:02Z' },
  ]

  it('메모를 시간 오름차순으로 정렬한다', () => {
    const sorted = sortNotesByTime(notes)
    expect(sorted[0].content).toBe('첫 번째 메모')
    expect(sorted[1].content).toBe('두 번째 메모')
    expect(sorted[2].content).toBe('세 번째 메모')
  })

  it('원본 배열을 변경하지 않는다', () => {
    sortNotesByTime(notes)
    expect(notes[0].content).toBe('세 번째 메모')  // 원본 유지
  })
})

describe('case_notes 멀티테넌트 격리', () => {
  it('같은 firm_id → 접근 가능', () => {
    expect(canAccessNote('firm-A', 'firm-A')).toBe(true)
  })

  it('다른 firm_id → 접근 불가', () => {
    expect(canAccessNote('firm-A', 'firm-B')).toBe(false)
  })

  it('firm_id가 빈 문자열 → 접근 불가', () => {
    expect(canAccessNote('firm-A', '')).toBe(false)
  })
})
