/**
 * AI retry logic unit tests
 * Tests pure retry wrapper behavior without actual Gemini API calls
 */
import { describe, it, expect, vi } from 'vitest'

// --- Pure retry wrapper (mirrors aiService retry strategy) ---

const FALLBACK_MSG = '죄송해요, 지금 연결이 원활하지 않네요. 잠시 후 다시 말씀해주시겠어요?'
const FALLBACK_MSG_2 = '잠시만요, 다시 한번 정리해볼게요...'

async function withRetry<T>(
  fn: () => Promise<T>,
  fallback: T,
  maxAttempts = 2,
  delayMs = 0
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch {
      if (attempt === maxAttempts) return fallback
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs))
    }
  }
  return fallback
}

// ---

describe('AI 재시도 로직', () => {
  it('1차 성공 → 그대로 반환한다', async () => {
    const fn = vi.fn().mockResolvedValueOnce({ reply: '안녕하세요' })
    const result = await withRetry(fn, { reply: FALLBACK_MSG })
    expect(result.reply).toBe('안녕하세요')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('1차 실패, 2차 성공 → 2차 결과를 반환한다', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ reply: '연결됐습니다' })
    const result = await withRetry(fn, { reply: FALLBACK_MSG })
    expect(result.reply).toBe('연결됐습니다')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('1, 2차 모두 실패 → fallback을 반환한다', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('API error'))
    const result = await withRetry(fn, { reply: FALLBACK_MSG })
    expect(result.reply).toBe(FALLBACK_MSG)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('3회 재시도 설정 시 최대 3회 시도한다', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'))
    await withRetry(fn, { reply: FALLBACK_MSG }, 3)
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('1회 설정 시 재시도 없이 바로 fallback 반환한다', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'))
    const result = await withRetry(fn, { reply: FALLBACK_MSG }, 1)
    expect(result.reply).toBe(FALLBACK_MSG)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('API timeout 에러도 재시도한다', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Request timeout'))
      .mockResolvedValueOnce({ reply: '재시도 성공' })
    const result = await withRetry(fn, { reply: FALLBACK_MSG })
    expect(result.reply).toBe('재시도 성공')
  })

  it('네트워크 에러도 재시도한다', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValueOnce({ reply: '재시도 성공' })
    const result = await withRetry(fn, { reply: FALLBACK_MSG })
    expect(result.reply).toBe('재시도 성공')
  })

  it('rate limit 에러도 재시도한다', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('429 Too Many Requests'))
      .mockResolvedValueOnce({ reply: '처리됐습니다' })
    const result = await withRetry(fn, { reply: FALLBACK_MSG })
    expect(result.reply).toBe('처리됐습니다')
  })
})

describe('fallback 메시지 품질', () => {
  it('fallback 메시지에 기술 용어가 없다', () => {
    const techTerms = ['error', 'Error', 'timeout', 'API', 'server', 'exception', '500', 'stack']
    for (const term of techTerms) {
      expect(FALLBACK_MSG).not.toContain(term)
    }
  })

  it('2차 fallback 메시지에도 기술 용어가 없다', () => {
    const techTerms = ['error', 'Error', 'timeout', 'API', 'server', 'exception', '500', 'stack']
    for (const term of techTerms) {
      expect(FALLBACK_MSG_2).not.toContain(term)
    }
  })

  it('fallback 메시지는 한국어다', () => {
    expect(FALLBACK_MSG).toMatch(/[가-힣]/)
    expect(FALLBACK_MSG_2).toMatch(/[가-힣]/)
  })
})
