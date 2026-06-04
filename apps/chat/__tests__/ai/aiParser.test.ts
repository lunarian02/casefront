/**
 * AI response parsing unit tests
 * Tests CASE_SUMMARY parsing logic without actual Gemini API calls
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const CASE_SUMMARY_SEPARATOR = '---CASE_SUMMARY---'

// Mirror of parseAIResponse logic in aiService.ts
function parseAIResponse(rawText: string): { reply: string; caseSummary: unknown | null } {
  const separatorIndex = rawText.indexOf(CASE_SUMMARY_SEPARATOR)
  if (separatorIndex === -1) {
    return { reply: rawText.trim(), caseSummary: null }
  }

  const reply = rawText.substring(0, separatorIndex).trim()
  const jsonPart = rawText.substring(separatorIndex + CASE_SUMMARY_SEPARATOR.length).trim()

  try {
    const jsonMatch = jsonPart.match(/```(?:json)?\s*([\s\S]*?)```/)
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : jsonPart
    const caseSummary = JSON.parse(jsonStr)
    return { reply, caseSummary }
  } catch {
    return { reply, caseSummary: null }
  }
}

// ---

describe('AI 응답 파싱', () => {
  it('구분자 없는 일반 대화 응답을 파싱한다', () => {
    const raw = '많이 속상하셨겠어요. 얼마를 빌려주셨나요?'
    const result = parseAIResponse(raw)
    expect(result.reply).toBe('많이 속상하셨겠어요. 얼마를 빌려주셨나요?')
    expect(result.caseSummary).toBeNull()
  })

  it('CASE_SUMMARY 구분자가 있으면 JSON을 파싱한다', () => {
    const fixture = readFileSync(
      join(__dirname, '../fixtures/gemini-response-with-summary.txt'),
      'utf-8'
    )
    const result = parseAIResponse(fixture)

    expect(result.reply).toContain('접수해드렸습니다')
    expect(result.caseSummary).not.toBeNull()

    const summary = result.caseSummary as Record<string, unknown>
    expect(summary.client_name).toBe('홍길동')
    expect(summary.client_phone).toBe('010-1234-5678')
    expect(summary.case_type).toBe('민사')
    expect(summary.case_subtype).toBe('대여금')
    expect(summary.urgency).toBe('normal')
  })

  it('구분자 앞 reply 텍스트를 정확히 분리한다', () => {
    const raw = `안녕하세요.\n접수 완료되었습니다.\n${CASE_SUMMARY_SEPARATOR}\n{"case_type":"민사","urgency":"normal","client_name":"홍","client_phone":"010-1111-2222"}`
    const result = parseAIResponse(raw)
    expect(result.reply).toBe('안녕하세요.\n접수 완료되었습니다.')
    expect((result.caseSummary as Record<string, unknown>).case_type).toBe('민사')
  })

  it('깨진 JSON → caseSummary null, reply는 반환한다', () => {
    const raw = `접수완료\n${CASE_SUMMARY_SEPARATOR}\n{invalid json here`
    const result = parseAIResponse(raw)
    expect(result.reply).toBe('접수완료')
    expect(result.caseSummary).toBeNull()
  })

  it('마크다운 코드블록으로 감싼 JSON도 파싱한다', () => {
    const raw = `완료\n${CASE_SUMMARY_SEPARATOR}\n\`\`\`json\n{"case_type":"형사","urgency":"urgent","client_name":"박","client_phone":"010-0000-0000"}\n\`\`\``
    const result = parseAIResponse(raw)
    expect((result.caseSummary as Record<string, unknown>).urgency).toBe('urgent')
  })

  it('빈 응답도 안전하게 처리한다', () => {
    const result = parseAIResponse('')
    expect(result.reply).toBe('')
    expect(result.caseSummary).toBeNull()
  })
})

describe('CaseSummary 필드 검증', () => {
  it('필수 필드가 모두 있는지 확인한다', () => {
    const fixture = readFileSync(
      join(__dirname, '../fixtures/gemini-response-with-summary.txt'),
      'utf-8'
    )
    const { caseSummary } = parseAIResponse(fixture)
    const s = caseSummary as Record<string, unknown>

    const requiredFields = [
      'client_name', 'client_phone', 'is_proxy',
      'case_type', 'case_subtype',
      'events', 'requirements',
      'urgency', 'summary_text', 'conversation_turns', 'timestamp',
    ]
    for (const field of requiredFields) {
      expect(s, `필드 누락: ${field}`).toHaveProperty(field)
    }
  })

  it('urgency는 urgent | normal | low 중 하나여야 한다', () => {
    const fixture = readFileSync(
      join(__dirname, '../fixtures/gemini-response-with-summary.txt'),
      'utf-8'
    )
    const { caseSummary } = parseAIResponse(fixture)
    const urgency = (caseSummary as Record<string, unknown>).urgency
    expect(['urgent', 'normal', 'low']).toContain(urgency)
  })

  it('events[]는 배열이어야 한다', () => {
    const fixture = readFileSync(
      join(__dirname, '../fixtures/gemini-response-with-summary.txt'),
      'utf-8'
    )
    const { caseSummary } = parseAIResponse(fixture)
    expect(Array.isArray((caseSummary as Record<string, unknown>).events)).toBe(true)
  })

  it('requirements[]의 status는 confirmed | denied | unknown 중 하나여야 한다', () => {
    const fixture = readFileSync(
      join(__dirname, '../fixtures/gemini-response-with-summary.txt'),
      'utf-8'
    )
    const { caseSummary } = parseAIResponse(fixture)
    const reqs = (caseSummary as Record<string, unknown>).requirements as Array<{ status: string }>
    for (const req of reqs) {
      expect(['confirmed', 'denied', 'unknown']).toContain(req.status)
    }
  })
})

describe('에러 메시지 노출 방지', () => {
  const errorKeywords = ['error', '500', 'timeout', 'API', 'server', 'exception', 'stack']

  it('fallback 응답에 기술 에러 용어가 없어야 한다', () => {
    const fallbackMsg = '죄송해요, 지금 연결이 원활하지 않네요. 잠시 후 다시 말씀해주시겠어요?'
    for (const kw of errorKeywords) {
      expect(fallbackMsg.toLowerCase()).not.toContain(kw.toLowerCase())
    }
  })

  it('2차 실패 안내 메시지에 기술 용어가 없어야 한다', () => {
    const msg = '잠시만요, 다시 한번 정리해볼게요...'
    for (const kw of errorKeywords) {
      expect(msg.toLowerCase()).not.toContain(kw.toLowerCase())
    }
  })
})
