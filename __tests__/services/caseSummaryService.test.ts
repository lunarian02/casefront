/**
 * caseSummaryService unit tests
 * Tests pure validation and normalization logic for case summary data
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { testCaseSummary } from '../fixtures/test-case-summary'

// --- Pure validation helpers ---

const VALID_CASE_TYPES = ['민사', '형사', '가사', '도산', '노동'] as const
const VALID_URGENCY = ['urgent', 'normal', 'low'] as const
const VALID_REQ_STATUS = ['confirmed', 'denied', 'unknown'] as const

function validateCaseType(type: string): boolean {
  return (VALID_CASE_TYPES as readonly string[]).includes(type)
}

function validateUrgency(urgency: string): boolean {
  return (VALID_URGENCY as readonly string[]).includes(urgency)
}

function validateRequirementStatus(status: string): boolean {
  return (VALID_REQ_STATUS as readonly string[]).includes(status)
}

function validateEvents(events: unknown): { valid: boolean; error?: string } {
  if (!Array.isArray(events)) return { valid: false, error: 'events must be array' }
  for (const e of events) {
    const ev = e as Record<string, unknown>
    if (!ev.date || !ev.subject || !ev.action || !ev.summary) {
      return { valid: false, error: 'event missing required fields (date, subject, action, summary)' }
    }
  }
  return { valid: true }
}

function validateRequirements(reqs: unknown): { valid: boolean; error?: string } {
  if (!Array.isArray(reqs)) return { valid: false, error: 'requirements must be array' }
  for (const r of reqs) {
    const req = r as Record<string, unknown>
    if (!req.element || !req.status || !req.detail) {
      return { valid: false, error: 'requirement missing fields (element, status, detail)' }
    }
    if (!validateRequirementStatus(req.status as string)) {
      return { valid: false, error: `invalid status: ${req.status}` }
    }
  }
  return { valid: true }
}

// status 전이 유효성 검사
const STATUS_TRANSITIONS: Record<string, string[]> = {
  new:       ['reviewing', 'done'],
  reviewing: ['done', 'new'],
  done:      ['reviewing'],
}

function isValidStatusTransition(from: string, to: string): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false
}

// ---

describe('CaseSummary 기본 필드 검증', () => {
  it('필수 필드가 모두 있다', () => {
    const required = [
      'client_name', 'client_phone', 'is_proxy',
      'case_type', 'case_subtype',
      'events', 'requirements',
      'urgency', 'summary_text', 'conversation_turns', 'timestamp',
    ]
    for (const field of required) {
      expect(testCaseSummary, `필드 누락: ${field}`).toHaveProperty(field)
    }
  })

  it('case_type이 유효한 값이다', () => {
    expect(validateCaseType(testCaseSummary.case_type)).toBe(true)
  })

  it('urgency가 유효한 값이다', () => {
    expect(validateUrgency(testCaseSummary.urgency)).toBe(true)
  })

  it('잘못된 case_type은 검증 실패한다', () => {
    expect(validateCaseType('기타')).toBe(false)
    expect(validateCaseType('')).toBe(false)
    expect(validateCaseType('criminal')).toBe(false)
    expect(validateCaseType('행정')).toBe(false)
  })

  it('잘못된 urgency는 검증 실패한다', () => {
    expect(validateUrgency('high')).toBe(false)
    expect(validateUrgency('medium')).toBe(false)
    expect(validateUrgency('')).toBe(false)
    expect(validateUrgency('긴급')).toBe(false)
  })

  it('is_proxy가 boolean이다', () => {
    expect(typeof testCaseSummary.is_proxy).toBe('boolean')
  })
})

describe('events[] 검증', () => {
  it('정상 events 배열은 통과한다', () => {
    const { valid } = validateEvents(testCaseSummary.events)
    expect(valid).toBe(true)
  })

  it('빈 배열도 유효하다', () => {
    expect(validateEvents([]).valid).toBe(true)
  })

  it('배열이 아니면 실패한다', () => {
    expect(validateEvents(null).valid).toBe(false)
    expect(validateEvents('string').valid).toBe(false)
  })

  it('date 누락 시 실패한다', () => {
    const { valid } = validateEvents([{ subject: '홍길동', action: '대여', summary: '요약' }])
    expect(valid).toBe(false)
  })

  it('action 누락 시 실패한다', () => {
    const { valid } = validateEvents([{ date: '2024-01-01', subject: '홍길동', summary: '요약' }])
    expect(valid).toBe(false)
  })

  it('summary 누락 시 실패한다', () => {
    const { valid } = validateEvents([{ date: '2024-01-01', subject: '홍길동', action: '대여' }])
    expect(valid).toBe(false)
  })
})

describe('requirements[] 검증', () => {
  it('정상 requirements는 통과한다', () => {
    const { valid } = validateRequirements(testCaseSummary.requirements)
    expect(valid).toBe(true)
  })

  it('빈 배열도 유효하다', () => {
    expect(validateRequirements([]).valid).toBe(true)
  })

  it('status가 confirmed/denied/unknown이어야 한다', () => {
    expect(validateRequirementStatus('confirmed')).toBe(true)
    expect(validateRequirementStatus('denied')).toBe(true)
    expect(validateRequirementStatus('unknown')).toBe(true)
    expect(validateRequirementStatus('pending')).toBe(false)
    expect(validateRequirementStatus('maybe')).toBe(false)
  })

  it('잘못된 status가 있으면 실패하고 에러 메시지를 반환한다', () => {
    const { valid, error } = validateRequirements([
      { element: '금전교부', status: 'maybe', detail: '3,000만원' },
    ])
    expect(valid).toBe(false)
    expect(error).toContain('maybe')
  })

  it('element 누락 시 실패한다', () => {
    const { valid } = validateRequirements([{ status: 'confirmed', detail: '확인됨' }])
    expect(valid).toBe(false)
  })
})

describe('사건 status 전이 검증', () => {
  it('new → reviewing 가능', () => {
    expect(isValidStatusTransition('new', 'reviewing')).toBe(true)
  })

  it('new → done 가능', () => {
    expect(isValidStatusTransition('new', 'done')).toBe(true)
  })

  it('reviewing → done 가능', () => {
    expect(isValidStatusTransition('reviewing', 'done')).toBe(true)
  })

  it('done → reviewing 가능 (되돌리기)', () => {
    expect(isValidStatusTransition('done', 'reviewing')).toBe(true)
  })

  it('done → new 불가', () => {
    expect(isValidStatusTransition('done', 'new')).toBe(false)
  })

  it('동일 status로 전이 불가', () => {
    expect(isValidStatusTransition('new', 'new')).toBe(false)
    expect(isValidStatusTransition('done', 'done')).toBe(false)
  })

  it('존재하지 않는 status → 불가', () => {
    expect(isValidStatusTransition('unknown', 'done')).toBe(false)
  })
})

describe('CaseSummary — fixture 연동', () => {
  it('gemini-response-with-summary.txt의 case_type, urgency가 유효하다', () => {
    const text = readFileSync(join(__dirname, '../fixtures/gemini-response-with-summary.txt'), 'utf-8')
    const json = JSON.parse(text.split('---CASE_SUMMARY---')[1].trim()) as Record<string, unknown>
    expect(validateCaseType(json.case_type as string)).toBe(true)
    expect(validateUrgency(json.urgency as string)).toBe(true)
  })

  it('urgent fixture의 events와 requirements가 유효하다', () => {
    const text = readFileSync(join(__dirname, '../fixtures/gemini-response-urgent.txt'), 'utf-8')
    const json = JSON.parse(text.split('---CASE_SUMMARY---')[1].trim())
    expect(validateEvents(json.events).valid).toBe(true)
    expect(validateRequirements(json.requirements).valid).toBe(true)
  })

  it('criminal fixture의 events가 2건 이상이다', () => {
    const text = readFileSync(join(__dirname, '../fixtures/gemini-response-criminal.txt'), 'utf-8')
    const json = JSON.parse(text.split('---CASE_SUMMARY---')[1].trim())
    expect(validateEvents(json.events).valid).toBe(true)
    expect(json.events.length).toBeGreaterThanOrEqual(2)
  })
})
