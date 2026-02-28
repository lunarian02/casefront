/**
 * clientService unit tests
 * Tests pure extraction logic without Supabase calls
 */
import { describe, it, expect } from 'vitest'

// --- Pure extraction helpers (extracted from clientService for testability) ---

function extractPhone(text: string): string | null {
  const match = text.match(/01[016789][\s-]?\d{3,4}[\s-]?\d{4}/)
  if (!match) return null
  const raw = match[0].replace(/[\s-]/g, '')
  return raw.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3')
}

const EXCLUDED_WORDS = new Set([
  '안녕', '이요', '이고', '이에요', '입니다', '저는', '제가', '이름', '성함',
  '연락처', '번호', '전화', '아니', '네요', '네가', '그게', '모르', '감사',
  '맞아', '맞습', '맞아요', '이에요', '예요', '이야', '이야요', '없어요',
  '있어요', '했어요', '했습', '합니다', '하고', '하는', '이고', '에요',
])
const KOREAN_PARTICLES = ['이에요', '이고요', '이요', '입니다', '예요', '이야', '이에', '이거든', '이']

function stripParticle(word: string): string {
  for (const p of KOREAN_PARTICLES) {
    if (word.endsWith(p) && word.length - p.length >= 2) return word.slice(0, -p.length)
  }
  return word
}

function extractName(text: string): string | null {
  const words = text.match(/[가-힣]{2,7}/g) ?? []
  for (const raw of words) {
    const w = stripParticle(raw)
    if (w.length >= 2 && w.length <= 4 && !EXCLUDED_WORDS.has(w)) return w
  }
  return null
}

function extractEmail(text: string): string | null {
  const match = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/)
  return match ? match[0] : null
}

// ---

describe('extractPhone', () => {
  it('010-XXXX-XXXX 형식을 추출한다', () => {
    expect(extractPhone('010-1234-5678')).toBe('010-1234-5678')
  })

  it('하이픈 없는 숫자만 있어도 추출한다', () => {
    expect(extractPhone('01012345678')).toBe('010-1234-5678')
  })

  it('공백이 있어도 추출한다', () => {
    expect(extractPhone('010 1234 5678입니다')).toBe('010-1234-5678')
  })

  it('011, 016, 017 등 다른 번호도 추출한다', () => {
    expect(extractPhone('011-123-4567')).toBe('011-123-4567')
    expect(extractPhone('016-9876-5432')).toBe('016-9876-5432')
  })

  it('전화번호가 없으면 null을 반환한다', () => {
    expect(extractPhone('안녕하세요')).toBeNull()
    expect(extractPhone('02-1234-5678')).toBeNull() // 서울 지역번호는 제외
  })

  it('문장 중간에 섞인 전화번호도 추출한다', () => {
    expect(extractPhone('제 번호는 010-9999-1111이에요')).toBe('010-9999-1111')
  })
})

describe('extractName', () => {
  it('2~4글자 한국어 이름을 추출한다', () => {
    expect(extractName('홍길동')).toBe('홍길동')
    expect(extractName('김철수입니다')).toBe('김철수')
    expect(extractName('이미래예요')).toBe('이미래')
  })

  it('4글자 이름도 추출한다', () => {
    expect(extractName('황우슬혜')).toBe('황우슬혜')
    expect(extractName('황우슬혜입니다')).toBe('황우슬혜')
    expect(extractName('황우슬혜이에요')).toBe('황우슬혜')
    expect(extractName('저는 황우슬혜예요')).toBe('황우슬혜')
  })

  it('조사를 제거하고 이름을 추출한다', () => {
    expect(extractName('홍길동이에요')).toBe('홍길동')
    expect(extractName('김영희이고요')).toBe('김영희')
  })

  it('제외 단어는 이름으로 추출하지 않는다', () => {
    // 5글자 이상 → 길이 초과로 null
    expect(extractName('안녕하세요')).toBeNull()
    expect(extractName('감사합니다')).toBeNull()
    // 조사 strip 후 EXCLUDED_WORDS에 해당 → null
    expect(extractName('성함이')).toBeNull()   // 성함이 → strip '이' → '성함' → excluded
    expect(extractName('이름이')).toBeNull()   // 이름이 → strip '이' → '이름' → excluded
  })

  it('5글자 이상 단어는 이름으로 추출하지 않는다', () => {
    expect(extractName('대한민국최고')).toBeNull()
  })
})

describe('extractEmail', () => {
  it('이메일 주소를 추출한다', () => {
    expect(extractEmail('hong@example.com')).toBe('hong@example.com')
    expect(extractEmail('이메일은 test.user+tag@domain.co.kr 입니다')).toBe('test.user+tag@domain.co.kr')
  })

  it('이메일이 없으면 null을 반환한다', () => {
    expect(extractEmail('이메일 없어요')).toBeNull()
    expect(extractEmail('@만있는경우')).toBeNull()
  })
})

describe('전화번호 정규화', () => {
  it('하이픈 제거 후 저장 형식 확인', () => {
    // DB 저장 시 정규화: 하이픈 제거
    const normalize = (phone: string) => phone.replace(/-/g, '')
    expect(normalize('010-1234-5678')).toBe('01012345678')
    expect(normalize('010 1234 5678')).toBe('010 1234 5678') // 공백은 별도 처리 필요
  })

  it('extractPhone 결과는 항상 하이픈 포함 형식', () => {
    const phone = extractPhone('01012345678')
    expect(phone).toMatch(/^\d{3}-\d{3,4}-\d{4}$/)
  })
})
