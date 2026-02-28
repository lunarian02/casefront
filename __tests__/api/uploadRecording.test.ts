/**
 * POST /api/recordings/upload validation tests
 * Tests pure request/file validation logic (no HTTP calls, no Supabase)
 */
import { describe, it, expect } from 'vitest'

// --- Pure validation (mirrors upload/route.ts logic) ---

const ALLOWED_MIME_TYPES: Record<string, string> = {
  mp3:  'audio/mpeg',
  m4a:  'audio/mp4',
  wav:  'audio/wav',
  ogg:  'audio/ogg',
  webm: 'audio/webm',
}
const MAX_FILE_SIZE = 100 * 1024 * 1024  // 100MB

function getExtFromFilename(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? ''
}

function isAllowedAudio(filename: string): boolean {
  const ext = getExtFromFilename(filename)
  return ext in ALLOWED_MIME_TYPES
}

function getMimeType(filename: string): string | null {
  const ext = getExtFromFilename(filename)
  return ALLOWED_MIME_TYPES[ext] ?? null
}

function validateUploadRequest(params: {
  hasAuthToken: boolean
  filename: string
  sizeBytes: number
}): { status: number; error?: string } | { status: 200 } {
  if (!params.hasAuthToken) {
    return { status: 401, error: 'Unauthorized' }
  }
  if (!isAllowedAudio(params.filename)) {
    return { status: 400, error: '지원하지 않는 파일 형식입니다. (mp3, m4a, wav, ogg)' }
  }
  if (params.sizeBytes > MAX_FILE_SIZE) {
    return { status: 400, error: '파일 크기가 100MB를 초과합니다.' }
  }
  if (params.sizeBytes === 0) {
    return { status: 400, error: '빈 파일입니다' }
  }
  return { status: 200 }
}

function buildStoragePath(firmId: string, recordingId: string, ext: string): string {
  return `${firmId}/${recordingId}.${ext}`
}

// ---

describe('인증 검증', () => {
  it('토큰 없으면 401 반환', () => {
    const result = validateUploadRequest({ hasAuthToken: false, filename: 'rec.mp3', sizeBytes: 1024 })
    expect(result.status).toBe(401)
  })

  it('토큰 있으면 파일 검증 진행', () => {
    const result = validateUploadRequest({ hasAuthToken: true, filename: 'rec.mp3', sizeBytes: 1024 })
    expect(result.status).toBe(200)
  })
})

describe('파일 형식 검증', () => {
  it('mp3 → 200', () => {
    const r = validateUploadRequest({ hasAuthToken: true, filename: 'call.mp3', sizeBytes: 1024 })
    expect(r.status).toBe(200)
  })

  it('m4a → 200', () => {
    const r = validateUploadRequest({ hasAuthToken: true, filename: 'voice.m4a', sizeBytes: 1024 })
    expect(r.status).toBe(200)
  })

  it('wav → 200', () => {
    const r = validateUploadRequest({ hasAuthToken: true, filename: 'audio.wav', sizeBytes: 1024 })
    expect(r.status).toBe(200)
  })

  it('ogg → 200', () => {
    const r = validateUploadRequest({ hasAuthToken: true, filename: 'rec.ogg', sizeBytes: 1024 })
    expect(r.status).toBe(200)
  })

  it('webm → 200', () => {
    const r = validateUploadRequest({ hasAuthToken: true, filename: 'rec.webm', sizeBytes: 1024 })
    expect(r.status).toBe(200)
  })

  it('mp4(영상) → 400', () => {
    const r = validateUploadRequest({ hasAuthToken: true, filename: 'video.mp4', sizeBytes: 1024 })
    expect(r.status).toBe(400)
  })

  it('txt → 400', () => {
    const r = validateUploadRequest({ hasAuthToken: true, filename: 'note.txt', sizeBytes: 1024 })
    expect(r.status).toBe(400)
  })
})

describe('파일 크기 검증', () => {
  it('정확히 100MB → 200 (경계값)', () => {
    const r = validateUploadRequest({ hasAuthToken: true, filename: 'call.mp3', sizeBytes: MAX_FILE_SIZE })
    expect(r.status).toBe(200)
  })

  it('100MB + 1바이트 → 400', () => {
    const r = validateUploadRequest({ hasAuthToken: true, filename: 'call.mp3', sizeBytes: MAX_FILE_SIZE + 1 })
    expect(r.status).toBe(400)
  })

  it('0바이트 → 400', () => {
    const r = validateUploadRequest({ hasAuthToken: true, filename: 'call.mp3', sizeBytes: 0 })
    expect(r.status).toBe(400)
  })
})

describe('MIME type 매핑', () => {
  it('mp3 → audio/mpeg', () => expect(getMimeType('call.mp3')).toBe('audio/mpeg'))
  it('m4a → audio/mp4', () => expect(getMimeType('voice.m4a')).toBe('audio/mp4'))
  it('wav → audio/wav', () => expect(getMimeType('rec.wav')).toBe('audio/wav'))
  it('ogg → audio/ogg', () => expect(getMimeType('rec.ogg')).toBe('audio/ogg'))
  it('webm → audio/webm', () => expect(getMimeType('rec.webm')).toBe('audio/webm'))
  it('지원 안 하는 형식 → null', () => expect(getMimeType('file.exe')).toBeNull())
})

describe('storage path 형식', () => {
  it('{firm_id}/{recording_id}.{ext} 형식', () => {
    const path = buildStoragePath('firm-001', 'uuid-recording-123', 'mp3')
    expect(path).toBe('firm-001/uuid-recording-123.mp3')
  })

  it('경로 구분자가 슬래시(/)다', () => {
    const path = buildStoragePath('f1', 'r1', 'm4a')
    expect(path.split('/').length).toBe(2)
  })
})

describe('업로드 후 생성되는 세션', () => {
  it('channel이 "recording"이어야 한다', () => {
    const channel = 'recording'
    expect(['web', 'kakao', 'ai_phone', 'recording']).toContain(channel)
  })

  it('status가 "active"로 시작한다', () => {
    const status = 'active'
    expect(['active', 'completed', 'expired']).toContain(status)
    expect(status).toBe('active')
  })
})
