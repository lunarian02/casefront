/**
 * AI conversation flow unit tests
 * Tests urgency determination, case type categorization, and response quality
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// --- Urgency determination (pure) ---

const DEADLINE_DAYS: Record<string, number> = {
  상속포기: 90,
  한정승인: 90,
  부당해고: 90,
  성희롱: 180,
}

function isUrgentByDeadline(subtype: string, eventDateIso: string, now = new Date()): boolean {
  const deadlineDays = DEADLINE_DAYS[subtype]
  if (!deadlineDays) return false
  const elapsed = Math.floor((now.getTime() - new Date(eventDateIso).getTime()) / 86400000)
  return elapsed > deadlineDays * 0.7
}

// --- Case type categorization (pure) ---

type CaseCategory = { type: string; subtype: string }

const CASE_KEYWORDS: Array<{ keywords: string[]; type: string; subtype: string }> = [
  { keywords: ['빌려', '빌려줬', '차용', '대여금'], type: '민사', subtype: '대여금' },
  { keywords: ['사기', '사기당', '사기를'], type: '형사', subtype: '사기' },
  { keywords: ['이혼', '이혼하고', '이혼을'], type: '가사', subtype: '이혼' },
  { keywords: ['해고', '해고당', '잘렸'], type: '노동', subtype: '해고·임금체불' },
  { keywords: ['빚', '파산', '회생', '개인파산'], type: '도산', subtype: '파산·회생' },
  { keywords: ['음주운전', '음주', '면허취소'], type: '형사', subtype: '기타' },
]

function categorizeCaseKeyword(text: string): CaseCategory | null {
  for (const entry of CASE_KEYWORDS) {
    if (entry.keywords.some((kw) => text.includes(kw))) {
      return { type: entry.type, subtype: entry.subtype }
    }
  }
  return null
}

// --- Response quality checks (pure) ---

const FORBIDDEN_IN_REPLY = [
  '승소 가능성', '이길 수 있', '질 수 있',
  '수임료', '착수금', '성공보수',
  '서버 오류', 'error', 'Error', 'timeout', 'exception',
]

function findQualityIssue(reply: string): string | null {
  for (const term of FORBIDDEN_IN_REPLY) {
    if (reply.includes(term)) return `금지 표현 포함: "${term}"`
  }
  return null
}

// ---

describe('긴급도 판단 — 시한 기반', () => {
  it('상속포기 기간 70% 이상 경과 → urgent', () => {
    const date = new Date(Date.now() - 65 * 86400000).toISOString()
    expect(isUrgentByDeadline('상속포기', date)).toBe(true)
  })

  it('상속포기 기간 50% 이하 → urgent 아님', () => {
    const date = new Date(Date.now() - 40 * 86400000).toISOString()
    expect(isUrgentByDeadline('상속포기', date)).toBe(false)
  })

  it('부당해고 3개월 임박 → urgent', () => {
    const date = new Date(Date.now() - 70 * 86400000).toISOString()
    expect(isUrgentByDeadline('부당해고', date)).toBe(true)
  })

  it('부당해고 초기 → urgent 아님', () => {
    const date = new Date(Date.now() - 10 * 86400000).toISOString()
    expect(isUrgentByDeadline('부당해고', date)).toBe(false)
  })

  it('deadline 없는 유형 → urgent 아님', () => {
    const date = new Date(Date.now() - 100 * 86400000).toISOString()
    expect(isUrgentByDeadline('대여금', date)).toBe(false)
    expect(isUrgentByDeadline('사기', date)).toBe(false)
  })

  it('urgent fixture: 구속 중 → urgency urgent', () => {
    const text = readFileSync(join(__dirname, '../fixtures/gemini-response-urgent.txt'), 'utf-8')
    const json = JSON.parse(text.split('---CASE_SUMMARY---')[1].trim())
    expect(json.urgency).toBe('urgent')
    expect(json.case_type).toBe('형사')
  })

  it('proxy fixture: 상속포기 기간 임박 → urgency urgent', () => {
    const text = readFileSync(join(__dirname, '../fixtures/gemini-response-proxy.txt'), 'utf-8')
    const json = JSON.parse(text.split('---CASE_SUMMARY---')[1].trim())
    expect(json.urgency).toBe('urgent')
    expect(json.urgency_reason).toContain('상속포기')
  })
})

describe('사건유형 분류 — 키워드', () => {
  it('"돈 빌려줬는데 안 갚아요" → 민사 / 대여금', () => {
    const r = categorizeCaseKeyword('돈 빌려줬는데 안 갚아요')
    expect(r?.type).toBe('민사')
    expect(r?.subtype).toBe('대여금')
  })

  it('"사기당했어요" → 형사 / 사기', () => {
    const r = categorizeCaseKeyword('사기당했어요 1000만원')
    expect(r?.type).toBe('형사')
    expect(r?.subtype).toBe('사기')
  })

  it('"이혼하고 싶어요" → 가사 / 이혼', () => {
    const r = categorizeCaseKeyword('이혼하고 싶어요')
    expect(r?.type).toBe('가사')
    expect(r?.subtype).toBe('이혼')
  })

  it('"해고당했어요" → 노동 / 해고·임금체불', () => {
    const r = categorizeCaseKeyword('부당하게 해고당했어요')
    expect(r?.type).toBe('노동')
    expect(r?.subtype).toBe('해고·임금체불')
  })

  it('"빚이 너무 많아요 파산 생각 중" → 도산 / 파산·회생', () => {
    const r = categorizeCaseKeyword('빚이 너무 많아요 파산 생각 중')
    expect(r?.type).toBe('도산')
    expect(r?.subtype).toBe('파산·회생')
  })

  it('"음주운전했어요" → 형사 / 기타', () => {
    const r = categorizeCaseKeyword('음주운전했어요 면허취소')
    expect(r?.type).toBe('형사')
    expect(r?.subtype).toBe('기타')
  })

  it('매칭 없으면 null 반환', () => {
    expect(categorizeCaseKeyword('안녕하세요 도움 받고 싶어요')).toBeNull()
  })
})

describe('AI 응답 품질 — 금지 표현', () => {
  it('정상 공감 응답에는 금지 표현이 없다', () => {
    const reply = '많이 속상하셨겠어요. 사건 접수 도와드리겠습니다. 어떤 상황인지 말씀해 주시겠어요?'
    expect(findQualityIssue(reply)).toBeNull()
  })

  it('법률 의견("승소 가능성") 감지', () => {
    expect(findQualityIssue('승소 가능성이 높습니다')).not.toBeNull()
  })

  it('법률 의견("이길 수 있") 감지', () => {
    expect(findQualityIssue('충분히 이길 수 있을 것 같습니다')).not.toBeNull()
  })

  it('수임료 언급 감지', () => {
    expect(findQualityIssue('수임료는 300만원입니다')).not.toBeNull()
    expect(findQualityIssue('착수금이 필요합니다')).not.toBeNull()
  })

  it('기술 에러 표현 감지', () => {
    expect(findQualityIssue('서버 오류가 발생했습니다')).not.toBeNull()
    expect(findQualityIssue('timeout이 발생했습니다')).not.toBeNull()
  })

  it('criminal fixture reply에 금지 표현 없음', () => {
    const text = readFileSync(join(__dirname, '../fixtures/gemini-response-criminal.txt'), 'utf-8')
    const reply = text.split('---CASE_SUMMARY---')[0].trim()
    expect(findQualityIssue(reply)).toBeNull()
  })

  it('urgent fixture reply에 금지 표현 없음', () => {
    const text = readFileSync(join(__dirname, '../fixtures/gemini-response-urgent.txt'), 'utf-8')
    const reply = text.split('---CASE_SUMMARY---')[0].trim()
    expect(findQualityIssue(reply)).toBeNull()
  })
})

describe('대화 플로우 — fixture 내용 검증', () => {
  it('proxy fixture: is_proxy=true, contact_* 필드 모두 존재', () => {
    const text = readFileSync(join(__dirname, '../fixtures/gemini-response-proxy.txt'), 'utf-8')
    const json = JSON.parse(text.split('---CASE_SUMMARY---')[1].trim())
    expect(json.is_proxy).toBe(true)
    expect(json.contact_name).not.toBeNull()
    expect(json.contact_phone).not.toBeNull()
    expect(json.contact_relation).not.toBeNull()
    // 당사자(client) vs 대리인(contact) 구분
    expect(json.client_name).toBe('박정호')
    expect(json.contact_name).toBe('박지훈')
  })

  it('criminal fixture: events 배열에 피해 내역 2건 포함', () => {
    const text = readFileSync(join(__dirname, '../fixtures/gemini-response-criminal.txt'), 'utf-8')
    const json = JSON.parse(text.split('---CASE_SUMMARY---')[1].trim())
    expect(json.case_type).toBe('형사')
    expect(json.position).toBe('피해자')
    expect(Array.isArray(json.events)).toBe(true)
    expect(json.events.length).toBeGreaterThanOrEqual(2)
  })

  it('모든 fixture의 urgency는 urgent | normal | low 중 하나', () => {
    const files = [
      '../fixtures/gemini-response-with-summary.txt',
      '../fixtures/gemini-response-urgent.txt',
      '../fixtures/gemini-response-proxy.txt',
      '../fixtures/gemini-response-criminal.txt',
    ]
    for (const f of files) {
      const text = readFileSync(join(__dirname, f), 'utf-8')
      const json = JSON.parse(text.split('---CASE_SUMMARY---')[1].trim())
      expect(['urgent', 'normal', 'low'], `${f}: urgency 오류`).toContain(json.urgency)
    }
  })

  it('모든 fixture의 requirements[].status는 confirmed | denied | unknown', () => {
    const files = [
      '../fixtures/gemini-response-with-summary.txt',
      '../fixtures/gemini-response-urgent.txt',
      '../fixtures/gemini-response-criminal.txt',
    ]
    for (const f of files) {
      const text = readFileSync(join(__dirname, f), 'utf-8')
      const json = JSON.parse(text.split('---CASE_SUMMARY---')[1].trim())
      for (const req of json.requirements as Array<{ status: string }>) {
        expect(['confirmed', 'denied', 'unknown'], `${f}: status 오류`).toContain(req.status)
      }
    }
  })
})
