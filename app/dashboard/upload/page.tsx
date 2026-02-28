'use client'
import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

type UploadState = 'idle' | 'uploading' | 'processing' | 'done' | 'error'

const ACCEPTED = '.mp3,.m4a,.wav,.ogg,.mp4'

export default function UploadPage() {
  const router = useRouter()
  const { session, loading } = useAuth()
  const [state, setState] = useState<UploadState>('idle')
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    if (!session) return

    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!['mp3', 'm4a', 'wav', 'ogg', 'mp4'].includes(ext)) {
      setErrorMsg('mp3, m4a, wav, ogg 파일만 지원합니다.')
      setState('error')
      return
    }
    if (file.size > 100 * 1024 * 1024) {
      setErrorMsg('파일 크기가 100MB를 초과합니다.')
      setState('error')
      return
    }

    setState('uploading')
    setProgress(20)
    setErrorMsg('')

    const token = session.access_token
    const formData = new FormData()
    formData.append('file', file)

    // Step 1: Upload to storage
    let uploadResult
    try {
      const res = await fetch('/api/recordings/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      uploadResult = await res.json()
      if (!res.ok) throw new Error(uploadResult.error ?? '업로드 실패')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '업로드 중 오류가 발생했습니다.')
      setState('error')
      return
    }

    setProgress(50)
    setState('processing')

    // Step 2: Transcribe + summarize
    let transcribeResult
    try {
      const res = await fetch('/api/recordings/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recording_id: uploadResult.recording_id,
          session_id: uploadResult.session_id,
          storage_path: uploadResult.storage_path,
          mime_type: uploadResult.mime_type,
        }),
      })
      transcribeResult = await res.json()
      if (!res.ok) throw new Error(transcribeResult.error ?? 'AI 처리 실패')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'AI 처리 중 오류가 발생했습니다.')
      setState('error')
      return
    }

    setProgress(100)
    setState('done')

    setTimeout(() => {
      router.push(`/dashboard/cases/${transcribeResult.case_id}`)
    }, 800)
  }, [session, router])

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  if (loading) return null

  return (
    <div className="max-w-xl mx-auto py-12 px-4">
      <div className="flex items-center gap-2 mb-8">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          ← 대시보드
        </button>
      </div>

      <h1 className="text-xl font-bold mb-2" style={{ color: '#1a2b5a' }}>통화 녹음 업로드</h1>
      <p className="text-sm text-slate-500 mb-8">녹음 파일을 업로드하면 AI가 자동으로 전사하고 사건 요약을 생성합니다.</p>

      {/* Upload Zone */}
      {state === 'idle' && (
        <div
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300 bg-white'
          }`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: '#f0f4ff' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1a2b5a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7 3.13-7 7-7"/>
              <path d="M15 5.5A9 9 0 0 1 19.5 10"/>
            </svg>
          </div>
          <p className="font-medium text-slate-700 mb-1">파일을 드래그하거나 클릭하여 선택</p>
          <p className="text-xs text-slate-400">mp3, m4a, wav, ogg · 최대 100MB (약 60분)</p>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={onFileChange}
          />
        </div>
      )}

      {/* Progress */}
      {(state === 'uploading' || state === 'processing') && (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm" style={{ border: '1px solid #e4e8f1' }}>
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: '#f0f4ff' }}>
            <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1a2b5a" strokeWidth="2" strokeLinecap="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          </div>
          <p className="font-semibold text-slate-700 mb-1">
            {state === 'uploading' ? '파일 업로드 중...' : 'AI가 전사 및 요약 중...'}
          </p>
          <p className="text-xs text-slate-400 mb-5">
            {state === 'processing' ? '1~2분 소요될 수 있습니다' : '잠시만 기다려주세요'}
          </p>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: '#e4e8f1' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, background: '#1a2b5a' }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-2">{progress}%</p>
        </div>
      )}

      {/* Done */}
      {state === 'done' && (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm" style={{ border: '1px solid #e4e8f1' }}>
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.08)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20,6 9,17 4,12"/>
            </svg>
          </div>
          <p className="font-semibold text-slate-700 mb-1">처리 완료!</p>
          <p className="text-xs text-slate-400">사건 상세 페이지로 이동 중...</p>
        </div>
      )}

      {/* Error */}
      {state === 'error' && (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm" style={{ border: '1px solid #fee2e2' }}>
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.08)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <p className="font-semibold text-slate-700 mb-1">업로드 실패</p>
          <p className="text-sm text-red-600 mb-5">{errorMsg}</p>
          <button
            onClick={() => { setState('idle'); setProgress(0) }}
            className="px-6 py-2 rounded-full text-sm font-medium text-white transition-opacity hover:opacity-80"
            style={{ background: '#1a2b5a' }}
          >
            다시 시도
          </button>
        </div>
      )}

      {/* Tips */}
      {state === 'idle' && (
        <div className="mt-6 p-4 rounded-xl text-sm" style={{ background: '#f8f9fe', border: '1px solid #e4e8f1' }}>
          <p className="font-medium text-slate-600 mb-2">갤럭시 공유 방법</p>
          <ol className="text-slate-500 space-y-1 text-xs">
            <li>1. 통화 녹음 앱에서 해당 녹음 선택</li>
            <li>2. 공유 버튼 탭</li>
            <li>3. 브라우저로 이 페이지 열기</li>
            <li>4. 파일 선택 후 자동 업로드</li>
          </ol>
        </div>
      )}
    </div>
  )
}
