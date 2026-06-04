/**
 * notifyService unit tests
 * Tests pure email subject/content generation logic (no Resend calls)
 */
import { describe, it, expect } from 'vitest'
import { testCaseSummary } from '../fixtures/test-case-summary'

// --- Pure email generation helpers (mirrored from notifyService.ts) ---

const URGENCY_LABELS: Record<string, string> = {
  urgent: '긴급',
  normal: '일반',
  low:    '여유',
}

function buildSubject(caseType: string, urgency: string): string {
  const label = URGENCY_LABELS[urgency] ?? urgency
  return `[CaseFront] 새 접수 — ${caseType} 건 (${label})`
}

function buildUrgencyBadge(urgency: string, urgencyReason?: string): string {
  if (urgency === 'urgent') {
    return urgencyReason ? `긴급 — ${urgencyReason}` : '긴급'
  }
  if (urgency === 'normal') return '일반'
  return '여유'
}

function hasToEmail(
  notifyEmail: string | null | undefined,
  lawyerEmail: string | null | undefined
): boolean {
  return !!((notifyEmail && notifyEmail.length > 0) || (lawyerEmail && lawyerEmail.length > 0))
}

interface EmailParams {
  firmName: string
  clientName: string
  clientPhone: string
  caseType: string
  urgencyBadge: string
  summaryText: string
  documentRequest?: string[]
  dashboardUrl: string
}

function buildEmailContent(params: EmailParams): string {
  const lines = [
    `사무소: ${params.firmName}`,
    `고객명: ${params.clientName}`,
    `연락처: ${params.clientPhone}`,
    `사건 유형: ${params.caseType}`,
    `긴급도: ${params.urgencyBadge}`,
    `요약: ${params.summaryText}`,
  ]
  if (params.documentRequest && params.documentRequest.length > 0) {
    lines.push(`증빙자료: ${params.documentRequest.join(', ')}`)
  }
  lines.push(`URL: ${params.dashboardUrl}`)
  return lines.join('\n')
}

// ---

describe('이메일 제목 생성', () => {
  it('normal 사건 → (일반) 포함', () => {
    const subject = buildSubject('민사', 'normal')
    expect(subject).toBe('[CaseFront] 새 접수 — 민사 건 (일반)')
    expect(subject).not.toContain('긴급')
  })

  it('urgent 사건 → (긴급) 포함', () => {
    const subject = buildSubject('형사', 'urgent')
    expect(subject).toBe('[CaseFront] 새 접수 — 형사 건 (긴급)')
    expect(subject).toContain('긴급')
  })

  it('low 사건 → (여유) 포함', () => {
    const subject = buildSubject('민사', 'low')
    expect(subject).toContain('여유')
  })

  it('제목에 [CaseFront] 브랜드 포함', () => {
    expect(buildSubject('가사', 'normal')).toContain('[CaseFront]')
  })

  it('제목에 사건 유형 포함', () => {
    expect(buildSubject('도산', 'low')).toContain('도산')
    expect(buildSubject('노동', 'normal')).toContain('노동')
    expect(buildSubject('가사', 'urgent')).toContain('가사')
  })

  it('5가지 사건유형 모두 제목 생성 가능', () => {
    const types = ['민사', '형사', '가사', '도산', '노동']
    for (const t of types) {
      const subject = buildSubject(t, 'normal')
      expect(subject).toContain(t)
    }
  })
})

describe('긴급도 뱃지 생성', () => {
  it('urgent + 사유 → 사유 포함', () => {
    const badge = buildUrgencyBadge('urgent', '현재 구속 중')
    expect(badge).toContain('긴급')
    expect(badge).toContain('현재 구속 중')
  })

  it('urgent + 사유 없음 → "긴급"만', () => {
    expect(buildUrgencyBadge('urgent')).toBe('긴급')
  })

  it('normal → "일반"', () => {
    expect(buildUrgencyBadge('normal')).toBe('일반')
  })

  it('low → "여유"', () => {
    expect(buildUrgencyBadge('low')).toBe('여유')
  })
})

describe('수신자 이메일 검증', () => {
  it('notify_email 있으면 발송 가능', () => {
    expect(hasToEmail('notify@lawfirm.com', null)).toBe(true)
  })

  it('lawyer_email만 있어도 발송 가능', () => {
    expect(hasToEmail(null, 'lawyer@lawfirm.com')).toBe(true)
  })

  it('둘 다 있으면 발송 가능', () => {
    expect(hasToEmail('notify@lawfirm.com', 'lawyer@lawfirm.com')).toBe(true)
  })

  it('둘 다 null → 발송 불가', () => {
    expect(hasToEmail(null, null)).toBe(false)
  })

  it('빈 문자열 → 발송 불가', () => {
    expect(hasToEmail('', '')).toBe(false)
  })
})

describe('이메일 본문 생성', () => {
  const baseParams: EmailParams = {
    firmName: '테스트 법률사무소',
    clientName: testCaseSummary.client_name,
    clientPhone: testCaseSummary.client_phone,
    caseType: testCaseSummary.case_type,
    urgencyBadge: buildUrgencyBadge(testCaseSummary.urgency),
    summaryText: testCaseSummary.summary_text,
    documentRequest: testCaseSummary.document_request,
    dashboardUrl: 'https://my.casefront.app/dashboard/cases/test-001',
  }

  it('고객명이 포함된다', () => {
    expect(buildEmailContent(baseParams)).toContain(testCaseSummary.client_name)
  })

  it('연락처가 포함된다', () => {
    expect(buildEmailContent(baseParams)).toContain(testCaseSummary.client_phone)
  })

  it('사건 유형이 포함된다', () => {
    expect(buildEmailContent(baseParams)).toContain(testCaseSummary.case_type)
  })

  it('대시보드 URL이 포함된다', () => {
    expect(buildEmailContent(baseParams)).toContain('https://my.casefront.app')
  })

  it('document_request가 있으면 증빙자료 항목 포함', () => {
    const content = buildEmailContent(baseParams)
    expect(content).toContain('증빙자료')
    expect(content).toContain('차용증 사본')
  })

  it('document_request가 빈 배열이면 증빙자료 항목 제외', () => {
    const content = buildEmailContent({ ...baseParams, documentRequest: [] })
    expect(content).not.toContain('증빙자료')
  })

  it('document_request가 없으면 증빙자료 항목 제외', () => {
    const { documentRequest: _, ...noDoc } = baseParams
    const content = buildEmailContent(noDoc as EmailParams)
    expect(content).not.toContain('증빙자료')
  })

  it('이메일 본문에 기술 에러 용어가 없다', () => {
    const techTerms = ['Error', 'exception', 'stack trace', 'undefined', 'NaN']
    const content = buildEmailContent(baseParams)
    for (const term of techTerms) {
      expect(content).not.toContain(term)
    }
  })
})
