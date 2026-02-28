/**
 * /api/cases/:id/files validation tests
 * Tests pure request validation and authorization logic
 */
import { describe, it, expect } from 'vitest'

// --- Pure validation helpers ---

const ALLOWED_FILE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'hwp', 'txt']
const MAX_FILE_SIZE = 20 * 1024 * 1024  // 20MB

function getExt(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? ''
}

function isAllowedFile(filename: string): boolean {
  return ALLOWED_FILE_EXTENSIONS.includes(getExt(filename))
}

function validateUploadFileRequest(params: {
  isAuthenticated: boolean
  firmId: string | null
  caseFirmId: string
  filename: string
  sizeBytes: number
}): { status: number; error?: string } | { status: 201 } {
  if (!params.isAuthenticated || !params.firmId) {
    return { status: 401, error: 'Unauthorized' }
  }
  if (params.firmId !== params.caseFirmId) {
    return { status: 403, error: '접근 권한이 없습니다' }
  }
  if (!isAllowedFile(params.filename)) {
    return { status: 400, error: '지원하지 않는 파일 형식입니다' }
  }
  if (params.sizeBytes > MAX_FILE_SIZE) {
    return { status: 413, error: '파일 크기가 20MB를 초과합니다' }
  }
  if (params.sizeBytes === 0) {
    return { status: 400, error: '빈 파일입니다' }
  }
  return { status: 201 }
}

function validateGetFilesRequest(params: {
  isAuthenticated: boolean
  firmId: string | null
  caseFirmId: string
}): { status: number; error?: string } | { status: 200 } {
  if (!params.isAuthenticated || !params.firmId) {
    return { status: 401, error: 'Unauthorized' }
  }
  if (params.firmId !== params.caseFirmId) {
    return { status: 403, error: '접근 권한이 없습니다' }
  }
  return { status: 200 }
}

function validateDeleteFileRequest(params: {
  isAuthenticated: boolean
  firmId: string | null
  fileFirmId: string
  fileExists: boolean
}): { status: number; error?: string } | { status: 200 } {
  if (!params.isAuthenticated || !params.firmId) {
    return { status: 401, error: 'Unauthorized' }
  }
  if (!params.fileExists) {
    return { status: 404, error: '파일을 찾을 수 없습니다' }
  }
  if (params.firmId !== params.fileFirmId) {
    return { status: 403, error: '접근 권한이 없습니다' }
  }
  return { status: 200 }
}

// ---

describe('POST /api/cases/:id/files', () => {
  const validParams = {
    isAuthenticated: true,
    firmId: 'firm-A',
    caseFirmId: 'firm-A',
    filename: 'contract.pdf',
    sizeBytes: 1 * 1024 * 1024,
  }

  it('정상 업로드 → 201', () => {
    expect(validateUploadFileRequest(validParams).status).toBe(201)
  })

  it('비로그인 → 401', () => {
    const r = validateUploadFileRequest({ ...validParams, isAuthenticated: false, firmId: null })
    expect(r.status).toBe(401)
  })

  it('다른 사무소 사건 → 403', () => {
    const r = validateUploadFileRequest({ ...validParams, caseFirmId: 'firm-B' })
    expect(r.status).toBe(403)
  })

  it('지원 안 하는 형식(exe) → 400', () => {
    const r = validateUploadFileRequest({ ...validParams, filename: 'virus.exe' })
    expect(r.status).toBe(400)
  })

  it('지원 안 하는 형식(zip) → 400', () => {
    const r = validateUploadFileRequest({ ...validParams, filename: 'archive.zip' })
    expect(r.status).toBe(400)
  })

  it('20MB 초과 → 413', () => {
    const r = validateUploadFileRequest({ ...validParams, sizeBytes: MAX_FILE_SIZE + 1 })
    expect(r.status).toBe(413)
  })

  it('정확히 20MB → 201 (경계값)', () => {
    const r = validateUploadFileRequest({ ...validParams, sizeBytes: MAX_FILE_SIZE })
    expect(r.status).toBe(201)
  })

  it('0바이트 → 400', () => {
    const r = validateUploadFileRequest({ ...validParams, sizeBytes: 0 })
    expect(r.status).toBe(400)
  })
})

describe('POST /api/cases/:id/files — 지원 형식', () => {
  const base = { isAuthenticated: true, firmId: 'firm-A', caseFirmId: 'firm-A', sizeBytes: 1024 }

  it('jpg → 201', () => expect(validateUploadFileRequest({ ...base, filename: 'photo.jpg' }).status).toBe(201))
  it('png → 201', () => expect(validateUploadFileRequest({ ...base, filename: 'scan.png' }).status).toBe(201))
  it('pdf → 201', () => expect(validateUploadFileRequest({ ...base, filename: 'doc.pdf' }).status).toBe(201))
  it('docx → 201', () => expect(validateUploadFileRequest({ ...base, filename: 'doc.docx' }).status).toBe(201))
  it('hwp → 201', () => expect(validateUploadFileRequest({ ...base, filename: 'doc.hwp' }).status).toBe(201))
})

describe('GET /api/cases/:id/files', () => {
  it('정상 요청 → 200', () => {
    const r = validateGetFilesRequest({ isAuthenticated: true, firmId: 'firm-A', caseFirmId: 'firm-A' })
    expect(r.status).toBe(200)
  })

  it('비로그인 → 401', () => {
    const r = validateGetFilesRequest({ isAuthenticated: false, firmId: null, caseFirmId: 'firm-A' })
    expect(r.status).toBe(401)
  })

  it('다른 사무소 사건 → 403', () => {
    const r = validateGetFilesRequest({ isAuthenticated: true, firmId: 'firm-A', caseFirmId: 'firm-B' })
    expect(r.status).toBe(403)
  })
})

describe('DELETE /api/cases/:id/files/:fileId', () => {
  const validParams = { isAuthenticated: true, firmId: 'firm-A', fileFirmId: 'firm-A', fileExists: true }

  it('정상 삭제 → 200', () => {
    expect(validateDeleteFileRequest(validParams).status).toBe(200)
  })

  it('비로그인 → 401', () => {
    const r = validateDeleteFileRequest({ ...validParams, isAuthenticated: false, firmId: null })
    expect(r.status).toBe(401)
  })

  it('존재하지 않는 파일 → 404', () => {
    const r = validateDeleteFileRequest({ ...validParams, fileExists: false })
    expect(r.status).toBe(404)
  })

  it('다른 사무소의 파일 → 403', () => {
    const r = validateDeleteFileRequest({ ...validParams, fileFirmId: 'firm-B' })
    expect(r.status).toBe(403)
  })
})
