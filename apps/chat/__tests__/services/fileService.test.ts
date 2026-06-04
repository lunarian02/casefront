/**
 * fileService unit tests
 * Tests pure validation logic for evidence file uploads
 */
import { describe, it, expect } from 'vitest'

// --- Pure validation helpers ---

const ALLOWED_FILE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'hwp', 'txt']
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  // 20MB

const VALID_CATEGORIES = ['차용증', '계약서', '진단서', '계좌내역', '사진', '판결문', '기타'] as const
type FileCategory = typeof VALID_CATEGORIES[number]

function getExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? ''
}

function isAllowedFileExtension(filename: string): boolean {
  return ALLOWED_FILE_EXTENSIONS.includes(getExtension(filename))
}

function validateFileSize(sizeBytes: number): { valid: boolean; error?: string } {
  if (sizeBytes === 0) return { valid: false, error: '빈 파일입니다' }
  if (sizeBytes > MAX_FILE_SIZE_BYTES) return { valid: false, error: '파일 크기가 20MB를 초과합니다' }
  return { valid: true }
}

function validateCategory(category: string | null | undefined): FileCategory {
  if (!category || !(VALID_CATEGORIES as readonly string[]).includes(category)) {
    return '기타'
  }
  return category as FileCategory
}

function buildStoragePath(firmId: string, caseId: string, fileId: string, ext: string): string {
  return `${firmId}/${caseId}/${fileId}.${ext}`
}

function validateUploadedBy(uploadedBy: string): boolean {
  return ['lawyer', 'client', 'system'].includes(uploadedBy)
}

function canAccessFile(fileFirmId: string, requestFirmId: string): boolean {
  return fileFirmId === requestFirmId
}

// ---

describe('증빙자료 파일 확장자 검증', () => {
  it('jpg → 허용', () => expect(isAllowedFileExtension('photo.jpg')).toBe(true))
  it('jpeg → 허용', () => expect(isAllowedFileExtension('scan.jpeg')).toBe(true))
  it('png → 허용', () => expect(isAllowedFileExtension('screenshot.png')).toBe(true))
  it('pdf → 허용', () => expect(isAllowedFileExtension('contract.pdf')).toBe(true))
  it('doc → 허용', () => expect(isAllowedFileExtension('document.doc')).toBe(true))
  it('docx → 허용', () => expect(isAllowedFileExtension('document.docx')).toBe(true))
  it('hwp → 허용', () => expect(isAllowedFileExtension('document.hwp')).toBe(true))

  it('exe → 거부', () => expect(isAllowedFileExtension('virus.exe')).toBe(false))
  it('zip → 거부', () => expect(isAllowedFileExtension('archive.zip')).toBe(false))
  it('mp3 → 거부 (증빙자료 아님)', () => expect(isAllowedFileExtension('audio.mp3')).toBe(false))
  it('js → 거부', () => expect(isAllowedFileExtension('script.js')).toBe(false))
  it('확장자 없는 파일 → 거부', () => expect(isAllowedFileExtension('noext')).toBe(false))
})

describe('파일 크기 검증 (20MB 제한)', () => {
  it('1MB → 통과', () => {
    expect(validateFileSize(1 * 1024 * 1024).valid).toBe(true)
  })

  it('정확히 20MB → 통과 (경계값)', () => {
    expect(validateFileSize(MAX_FILE_SIZE_BYTES).valid).toBe(true)
  })

  it('20MB + 1바이트 → 실패', () => {
    const { valid, error } = validateFileSize(MAX_FILE_SIZE_BYTES + 1)
    expect(valid).toBe(false)
    expect(error).toContain('20MB')
  })

  it('0바이트 → 실패', () => {
    expect(validateFileSize(0).valid).toBe(false)
  })
})

describe('파일 카테고리 검증', () => {
  it('"차용증" → 유효', () => expect(validateCategory('차용증')).toBe('차용증'))
  it('"계약서" → 유효', () => expect(validateCategory('계약서')).toBe('계약서'))
  it('"기타" → 유효', () => expect(validateCategory('기타')).toBe('기타'))

  it('카테고리 없음(null) → 기본값 "기타"', () => {
    expect(validateCategory(null)).toBe('기타')
  })

  it('카테고리 없음(undefined) → 기본값 "기타"', () => {
    expect(validateCategory(undefined)).toBe('기타')
  })

  it('유효하지 않은 카테고리 → "기타"로 대체', () => {
    expect(validateCategory('unknown_category')).toBe('기타')
    expect(validateCategory('')).toBe('기타')
  })
})

describe('storage_path 형식', () => {
  it('{firm_id}/{case_id}/{file_id}.{ext} 형식', () => {
    const path = buildStoragePath('firm-001', 'case-abc', 'file-xyz', 'pdf')
    expect(path).toBe('firm-001/case-abc/file-xyz.pdf')
  })

  it('경로 구분자가 슬래시(/)다', () => {
    const path = buildStoragePath('f1', 'c1', 'fid', 'jpg')
    expect(path.split('/').length).toBe(3)
  })

  it('확장자가 포함된다', () => {
    expect(buildStoragePath('f', 'c', 'id', 'hwp').endsWith('.hwp')).toBe(true)
  })
})

describe('uploaded_by 검증', () => {
  it('"lawyer" → 유효', () => expect(validateUploadedBy('lawyer')).toBe(true))
  it('"client" → 유효', () => expect(validateUploadedBy('client')).toBe(true))
  it('"system" → 유효', () => expect(validateUploadedBy('system')).toBe(true))
  it('그 외 → 무효', () => {
    expect(validateUploadedBy('admin')).toBe(false)
    expect(validateUploadedBy('')).toBe(false)
  })
})

describe('파일 멀티테넌트 격리', () => {
  it('같은 firm_id → 접근 가능', () => {
    expect(canAccessFile('firm-A', 'firm-A')).toBe(true)
  })

  it('다른 firm_id → 접근 불가', () => {
    expect(canAccessFile('firm-A', 'firm-B')).toBe(false)
  })
})
