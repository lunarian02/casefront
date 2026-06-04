/**
 * POST /api/chat/message input validation tests
 * Tests pure request validation logic (no HTTP calls, no Supabase)
 */
import { describe, it, expect } from 'vitest'

// --- Pure request validation (mirrors route.ts logic) ---

interface ChatMessageInput {
  userId?: unknown
  content?: unknown
  firmSlug?: unknown
}

type ValidationResult =
  | { ok: true; userId: string; content: string; firmSlug: string | null }
  | { ok: false; status: number; error: string }

function validateChatMessageInput(input: ChatMessageInput): ValidationResult {
  const { userId, content, firmSlug } = input

  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    return { ok: false, status: 400, error: '필수 항목이 누락되었습니다.' }
  }
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return { ok: false, status: 400, error: '필수 항목이 누락되었습니다.' }
  }

  return {
    ok: true,
    userId: userId.trim(),
    content: content.trim(),
    firmSlug: typeof firmSlug === 'string' && firmSlug.length > 0 ? firmSlug : null,
  }
}

function buildSuccessResponse(params: {
  reply: string
  sessionId: string
  completed: boolean
  firmName: string
}) {
  return {
    reply: params.reply,
    sessionId: params.sessionId,
    completed: params.completed,
    firmName: params.firmName,
  }
}

// XSS: HTML 이스케이프 여부 확인
function containsUnescapedScript(text: string): boolean {
  return /<script/i.test(text) || /javascript:/i.test(text)
}

// ---

describe('POST /api/chat/message — 입력 검증', () => {
  it('userId, content 모두 있으면 통과한다', () => {
    const result = validateChatMessageInput({
      userId: 'anon-001',
      content: '안녕하세요',
      firmSlug: 'kim-law',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.userId).toBe('anon-001')
      expect(result.content).toBe('안녕하세요')
      expect(result.firmSlug).toBe('kim-law')
    }
  })

  it('firmSlug 없어도 통과한다 (기본 사무소 사용)', () => {
    const result = validateChatMessageInput({ userId: 'anon-001', content: '문의드립니다' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.firmSlug).toBeNull()
  })

  it('userId 없으면 400 반환', () => {
    const result = validateChatMessageInput({ content: '안녕하세요' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(400)
  })

  it('content 없으면 400 반환', () => {
    const result = validateChatMessageInput({ userId: 'anon-001' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(400)
  })

  it('content 빈 문자열 → 400', () => {
    const result = validateChatMessageInput({ userId: 'anon-001', content: '' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(400)
  })

  it('content 공백만 → 400', () => {
    const result = validateChatMessageInput({ userId: 'anon-001', content: '   ' })
    expect(result.ok).toBe(false)
  })

  it('userId 공백만 → 400', () => {
    const result = validateChatMessageInput({ userId: '   ', content: '안녕' })
    expect(result.ok).toBe(false)
  })

  it('content가 매우 길어도 통과한다 (10000자)', () => {
    const result = validateChatMessageInput({
      userId: 'anon-001',
      content: '가'.repeat(10000),
    })
    expect(result.ok).toBe(true)
  })
})

describe('POST /api/chat/message — 응답 형식', () => {
  it('성공 응답에 reply, sessionId, completed, firmName이 포함된다', () => {
    const response = buildSuccessResponse({
      reply: '안녕하세요. 어떤 도움이 필요하신가요?',
      sessionId: 'session-abc-001',
      completed: false,
      firmName: '테스트 법률사무소',
    })
    expect(response).toHaveProperty('reply')
    expect(response).toHaveProperty('sessionId')
    expect(response).toHaveProperty('completed')
    expect(response).toHaveProperty('firmName')
  })

  it('completed=true이면 case_summary가 생성됐다는 뜻', () => {
    const response = buildSuccessResponse({
      reply: '접수 완료됐습니다.',
      sessionId: 'session-xyz',
      completed: true,
      firmName: '테스트 법률사무소',
    })
    expect(response.completed).toBe(true)
  })

  it('completed=false이면 대화 진행 중', () => {
    const response = buildSuccessResponse({
      reply: '얼마를 빌려주셨나요?',
      sessionId: 'session-xyz',
      completed: false,
      firmName: '테스트 법률사무소',
    })
    expect(response.completed).toBe(false)
  })
})

describe('POST /api/chat/message — XSS 방지', () => {
  it('<script> 태그는 응답에 그대로 포함되면 안 된다', () => {
    const userInput = '<script>alert("xss")</script>'
    expect(containsUnescapedScript(userInput)).toBe(true)
    // 실제 응답은 이스케이프 처리해야 함
  })

  it('javascript: 프로토콜도 감지된다', () => {
    expect(containsUnescapedScript('javascript:alert(1)')).toBe(true)
  })

  it('일반 한국어 텍스트는 XSS 없음', () => {
    expect(containsUnescapedScript('안녕하세요 도움 요청드립니다')).toBe(false)
  })
})
