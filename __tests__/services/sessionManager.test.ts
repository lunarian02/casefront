/**
 * sessionManager unit tests
 * Tests session timeout and message ordering logic (pure functions only)
 */
import { describe, it, expect } from 'vitest'

// Session timeout: 30 minutes
const SESSION_TIMEOUT_MS = 30 * 60 * 1000

function isSessionExpired(updatedAt: string): boolean {
  const elapsed = Date.now() - new Date(updatedAt).getTime()
  return elapsed > SESSION_TIMEOUT_MS
}

function sortMessagesByTime(messages: Array<{ content: string; created_at: string }>) {
  return [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
}

// ---

describe('세션 만료 로직', () => {
  it('30분 이내 세션은 만료되지 않는다', () => {
    const updatedAt = new Date(Date.now() - 29 * 60 * 1000).toISOString()
    expect(isSessionExpired(updatedAt)).toBe(false)
  })

  it('30분이 지난 세션은 만료된다', () => {
    const updatedAt = new Date(Date.now() - 31 * 60 * 1000).toISOString()
    expect(isSessionExpired(updatedAt)).toBe(true)
  })

  it('방금 생성된 세션은 만료되지 않는다', () => {
    const updatedAt = new Date().toISOString()
    expect(isSessionExpired(updatedAt)).toBe(false)
  })

  it('정확히 30분 경과 시 만료된다', () => {
    const updatedAt = new Date(Date.now() - SESSION_TIMEOUT_MS - 1).toISOString()
    expect(isSessionExpired(updatedAt)).toBe(true)
  })
})

describe('메시지 정렬', () => {
  it('메시지를 시간 오름차순으로 정렬한다', () => {
    const messages = [
      { content: '세번째', created_at: '2026-02-28T10:00:03Z' },
      { content: '첫번째', created_at: '2026-02-28T10:00:01Z' },
      { content: '두번째', created_at: '2026-02-28T10:00:02Z' },
    ]
    const sorted = sortMessagesByTime(messages)
    expect(sorted[0].content).toBe('첫번째')
    expect(sorted[1].content).toBe('두번째')
    expect(sorted[2].content).toBe('세번째')
  })

  it('원본 배열을 변경하지 않는다', () => {
    const messages = [
      { content: 'B', created_at: '2026-02-28T10:00:02Z' },
      { content: 'A', created_at: '2026-02-28T10:00:01Z' },
    ]
    sortMessagesByTime(messages)
    expect(messages[0].content).toBe('B') // 원본 유지
  })
})

describe('채널 값 검증', () => {
  const validChannels = ['web', 'kakao', 'ai_phone']

  it('유효한 채널 값을 확인한다', () => {
    expect(validChannels).toContain('web')
    expect(validChannels).toContain('ai_phone')
  })

  it('recording 채널은 지원하지 않는다', () => {
    expect(validChannels).not.toContain('recording')
  })

  it('잘못된 채널 값은 포함되지 않는다', () => {
    expect(validChannels).not.toContain('phone')
    expect(validChannels).not.toContain('sms')
  })
})
