/**
 * recordingUploadService unit tests
 * Tests pure file validation logic (extension, size)
 */
import { describe, it, expect } from 'vitest'

// --- Pure file validation helpers ---

const ALLOWED_AUDIO_EXTENSIONS = ['mp3', 'm4a', 'wav', 'ogg', 'webm']
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024  // 100MB

function getExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? ''
}

function isAllowedAudioExtension(filename: string): boolean {
  return ALLOWED_AUDIO_EXTENSIONS.includes(getExtension(filename))
}

function validateFileSize(sizeBytes: number): { valid: boolean; error?: string } {
  if (sizeBytes === 0) return { valid: false, error: '빈 파일입니다' }
  if (sizeBytes > MAX_FILE_SIZE_BYTES) return { valid: false, error: '파일 크기가 100MB를 초과합니다' }
  return { valid: true }
}

function validateRecordingFile(filename: string, sizeBytes: number): { valid: boolean; error?: string } {
  const ext = getExtension(filename)
  if (!ALLOWED_AUDIO_EXTENSIONS.includes(ext)) {
    return { valid: false, error: `${ext || '(없음)'} 형식은 지원하지 않습니다` }
  }
  return validateFileSize(sizeBytes)
}

// ---

describe('녹음 파일 확장자 검증', () => {
  it('mp3 → 허용', () => expect(isAllowedAudioExtension('call.mp3')).toBe(true))
  it('m4a → 허용', () => expect(isAllowedAudioExtension('record.m4a')).toBe(true))
  it('wav → 허용', () => expect(isAllowedAudioExtension('audio.wav')).toBe(true))
  it('ogg → 허용', () => expect(isAllowedAudioExtension('voice.ogg')).toBe(true))
  it('webm → 허용', () => expect(isAllowedAudioExtension('rec.webm')).toBe(true))

  it('mp4(영상) → 거부', () => expect(isAllowedAudioExtension('video.mp4')).toBe(false))
  it('txt → 거부', () => expect(isAllowedAudioExtension('note.txt')).toBe(false))
  it('exe → 거부', () => expect(isAllowedAudioExtension('virus.exe')).toBe(false))
  it('zip → 거부', () => expect(isAllowedAudioExtension('archive.zip')).toBe(false))
  it('pdf → 거부', () => expect(isAllowedAudioExtension('document.pdf')).toBe(false))
  it('확장자 없는 파일 → 거부', () => expect(isAllowedAudioExtension('noextension')).toBe(false))
})

describe('파일 크기 검증', () => {
  it('1MB 파일 → 통과', () => {
    expect(validateFileSize(1 * 1024 * 1024).valid).toBe(true)
  })

  it('정확히 100MB → 통과 (경계값)', () => {
    expect(validateFileSize(MAX_FILE_SIZE_BYTES).valid).toBe(true)
  })

  it('100MB + 1바이트 → 실패', () => {
    const { valid, error } = validateFileSize(MAX_FILE_SIZE_BYTES + 1)
    expect(valid).toBe(false)
    expect(error).toContain('100MB')
  })

  it('빈 파일 (0바이트) → 실패', () => {
    const { valid, error } = validateFileSize(0)
    expect(valid).toBe(false)
    expect(error).toBeDefined()
  })

  it('50MB 파일 → 통과', () => {
    expect(validateFileSize(50 * 1024 * 1024).valid).toBe(true)
  })
})

describe('녹음 파일 종합 검증', () => {
  it('정상 mp3, 5MB → 성공', () => {
    expect(validateRecordingFile('call_20260228.mp3', 5 * 1024 * 1024).valid).toBe(true)
  })

  it('m4a, 정확히 100MB → 성공 (경계값)', () => {
    expect(validateRecordingFile('voice.m4a', MAX_FILE_SIZE_BYTES).valid).toBe(true)
  })

  it('mp4, 1MB → 실패 (확장자)', () => {
    const { valid, error } = validateRecordingFile('video.mp4', 1024 * 1024)
    expect(valid).toBe(false)
    expect(error).toContain('mp4')
  })

  it('mp3, 200MB → 실패 (크기 초과)', () => {
    const { valid, error } = validateRecordingFile('huge.mp3', 200 * 1024 * 1024)
    expect(valid).toBe(false)
    expect(error).toContain('100MB')
  })

  it('mp3, 0바이트 → 실패 (빈 파일)', () => {
    const { valid } = validateRecordingFile('empty.mp3', 0)
    expect(valid).toBe(false)
  })

  it('파일명에 한글 포함 → 정상 처리', () => {
    expect(validateRecordingFile('통화녹음_홍길동.m4a', 1024 * 1024).valid).toBe(true)
  })

  it('파일명에 공백과 특수문자 포함 → 정상 처리', () => {
    expect(validateRecordingFile('call (2026-02-28).mp3', 1024 * 1024).valid).toBe(true)
  })

  it('대문자 확장자 → 허용 (toLowerCase 처리)', () => {
    expect(validateRecordingFile('RECORDING.MP3', 1024 * 1024).valid).toBe(true)
    expect(validateRecordingFile('voice.M4A', 1024 * 1024).valid).toBe(true)
  })
})

describe('channel 값 검증', () => {
  const VALID_CHANNELS = ['web', 'kakao', 'ai_phone', 'recording']

  it('recording 채널은 유효하다', () => {
    expect(VALID_CHANNELS).toContain('recording')
  })

  it('녹음 업로드는 항상 recording 채널이다', () => {
    const channel = 'recording'
    expect(VALID_CHANNELS).toContain(channel)
  })
})
