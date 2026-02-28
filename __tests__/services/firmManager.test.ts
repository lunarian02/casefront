/**
 * firmManager unit tests
 * Tests pure slug validation and firm settings logic
 */
import { describe, it, expect } from 'vitest'
import { testFirm } from '../fixtures/test-firm'

// --- Pure validation helpers ---

function isValidSlug(slug: string): boolean {
  if (!slug || slug.length === 0) return false
  // lowercase alphanumeric and hyphens, no leading/trailing hyphen
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug)
}

function normalizeSlug(slug: string): string {
  return slug
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

interface FirmSettings {
  voice?: 'female' | 'male'
  greeting?: string
  [key: string]: unknown
}

const DEFAULT_SETTINGS: FirmSettings = {
  voice: 'female',
}

function getFirmSettings(settings: FirmSettings | null | undefined): FirmSettings {
  if (!settings) return { ...DEFAULT_SETTINGS }
  return { ...DEFAULT_SETTINGS, ...settings }
}

// ---

describe('slug 유효성 검사', () => {
  it('영문 소문자만 → 유효', () => {
    expect(isValidSlug('lawfirm')).toBe(true)
  })

  it('소문자 + 숫자 조합 → 유효', () => {
    expect(isValidSlug('lawfirm123')).toBe(true)
  })

  it('하이픈 포함 → 유효', () => {
    expect(isValidSlug('kim-law')).toBe(true)
    expect(isValidSlug('my-law-firm')).toBe(true)
  })

  it('단일 문자 → 유효', () => {
    expect(isValidSlug('a')).toBe(true)
    expect(isValidSlug('1')).toBe(true)
  })

  it('빈 문자열 → 무효', () => {
    expect(isValidSlug('')).toBe(false)
  })

  it('대문자 포함 → 무효', () => {
    expect(isValidSlug('LawFirm')).toBe(false)
    expect(isValidSlug('LAW')).toBe(false)
  })

  it('밑줄(_) → 무효', () => {
    expect(isValidSlug('law_firm')).toBe(false)
  })

  it('점(.) → 무효', () => {
    expect(isValidSlug('law.firm')).toBe(false)
  })

  it('한글 → 무효', () => {
    expect(isValidSlug('법무법인')).toBe(false)
  })

  it('하이픈으로 시작 → 무효', () => {
    expect(isValidSlug('-lawfirm')).toBe(false)
  })

  it('하이픈으로 끝 → 무효', () => {
    expect(isValidSlug('lawfirm-')).toBe(false)
  })

  it('공백 포함 → 무효', () => {
    expect(isValidSlug('law firm')).toBe(false)
  })
})

describe('slug 정규화', () => {
  it('대문자 → 소문자', () => {
    expect(normalizeSlug('LawFirm')).toBe('lawfirm')
  })

  it('공백 → 하이픈', () => {
    expect(normalizeSlug('law firm')).toBe('law-firm')
  })

  it('연속 하이픈 → 단일 하이픈', () => {
    expect(normalizeSlug('law--firm')).toBe('law-firm')
  })

  it('앞뒤 공백 제거 후 변환', () => {
    expect(normalizeSlug('  lawfirm  ')).toBe('lawfirm')
  })

  it('앞뒤 하이픈 제거', () => {
    expect(normalizeSlug('-lawfirm-')).toBe('lawfirm')
  })

  it('특수문자 → 하이픈', () => {
    expect(normalizeSlug('law.firm')).toBe('law-firm')
    expect(normalizeSlug('law_firm')).toBe('law-firm')
  })

  it('이미 유효한 slug → 그대로', () => {
    expect(normalizeSlug('kim-law')).toBe('kim-law')
    expect(normalizeSlug('lawfirm123')).toBe('lawfirm123')
  })
})

describe('firm settings 기본값', () => {
  it('settings null → 기본값 반환', () => {
    const s = getFirmSettings(null)
    expect(s.voice).toBe('female')
  })

  it('settings undefined → 기본값 반환', () => {
    const s = getFirmSettings(undefined)
    expect(s.voice).toBe('female')
  })

  it('커스텀 voice 설정 적용', () => {
    const s = getFirmSettings({ voice: 'male' })
    expect(s.voice).toBe('male')
  })

  it('부분 설정 시 나머지는 기본값 유지', () => {
    const s = getFirmSettings({ greeting: '안녕하세요, 법률사무소입니다.' })
    expect(s.voice).toBe('female')        // 기본값 유지
    expect(s.greeting).toBe('안녕하세요, 법률사무소입니다.')
  })
})

describe('testFirm fixture', () => {
  it('필수 필드를 가진다', () => {
    expect(testFirm).toHaveProperty('id')
    expect(testFirm).toHaveProperty('slug')
    expect(testFirm).toHaveProperty('name')
  })

  it('slug가 유효한 형식이다', () => {
    if (testFirm.slug) {
      expect(isValidSlug(testFirm.slug)).toBe(true)
    }
  })
})
